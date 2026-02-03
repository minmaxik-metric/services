import { ExtractEvent } from "@citec-spbu/contracts"
import { Injectable } from "@nestjs/common"
import { EmitterWebhookEvent } from "@octokit/webhooks"

import { MongoService } from "@/infrastructure/mongo/mongodb.service"
import { RawEventDocument } from "@/infrastructure/mongo/schemas"
import {
	NormalizedEvent,
	NormalizedEventDocument
} from "@/infrastructure/mongo/schemas/normalized-events.schema"
import { hasTypename } from "@/modules/github/api/helpers"

import {
	GetIssuesResult,
	GetIssueTimelineResult
} from "../../github/api/github-api.service"

import { BaseNormalizer } from "./base.normalizer"
import { EventNormalizer } from "./types"

type PollingIssue = NonNullable<GetIssuesResult["issues"][number]>
type PollingTimelineItem = NonNullable<
	GetIssueTimelineResult["timeline"][number]
>
type WebhookIssuesPayload = EmitterWebhookEvent<"issues">["payload"]
type SupportedPollingTimelineItem = Extract<
	PollingTimelineItem,
	{
		__typename:
			| "ClosedEvent"
			| "ReopenedEvent"
			| "LabeledEvent"
			| "UnlabeledEvent"
			| "AssignedEvent"
			| "UnassignedEvent"
			| "IssueTypeAddedEvent"
			| "IssueTypeChangedEvent"
			| "IssueTypeRemovedEvent"
			| "IssueComment"
			| "CommentDeletedEvent"
	}
>
type UserActor = { id: string; login: string }

type PollingContext = {
	item: SupportedPollingTimelineItem
	issue: PollingIssue
	base: Pick<
		NormalizedEvent,
		"event_key" | "source" | "repository" | "repositoryOwner"
	>
}

type WebhookContext = {
	event: RawEventDocument
	payload: WebhookIssuesPayload
	base: Pick<
		NormalizedEvent,
		"event_key" | "source" | "repository" | "repositoryOwner"
	>
}

@Injectable()
export class IssueTimelineNormalizer
	extends BaseNormalizer
	implements EventNormalizer
{
	public constructor(mongoService: MongoService) {
		super(mongoService)
	}

	public async normalize(
		event: RawEventDocument
	): Promise<NormalizedEventDocument | null> {
		switch (event.method) {
			case "manual":
			case "polling":
				return await this.normalizePolling(event)
			case "webhook":
				return await this.normalizeWebhook(event)
		}
	}

	private readonly pollingMappers: Record<
		string,
		(ctx: PollingContext) => NormalizedEvent | null
	> = {
		ClosedEvent: ctx => this.mapPollingStateChanged(ctx, "closed"),
		ReopenedEvent: ctx => this.mapPollingStateChanged(ctx, "reopened"),
		LabeledEvent: ctx => this.mapPollingLabel(ctx, "labeled"),
		UnlabeledEvent: ctx => this.mapPollingLabel(ctx, "unlabeled"),
		AssignedEvent: ctx => this.mapPollingAssignee(ctx, "assigned"),
		UnassignedEvent: ctx => this.mapPollingAssignee(ctx, "unassigned"),
		IssueTypeAddedEvent: ctx => this.mapPollingType(ctx, "typed"),
		IssueTypeChangedEvent: ctx => this.mapPollingType(ctx, "typed"),
		IssueTypeRemovedEvent: ctx => this.mapPollingType(ctx, "untyped"),
		IssueComment: ctx => this.mapPollingComment(ctx),
		CommentDeletedEvent: ctx => this.mapPollingCommentDeleted(ctx)
	}

	private readonly webhookMappers: Record<
		string,
		(ctx: WebhookContext) => NormalizedEvent | null
	> = {
		closed: ctx => this.mapWebhookStateChanged(ctx, "closed"),
		reopened: ctx => this.mapWebhookStateChanged(ctx, "reopened"),
		assigned: ctx => this.mapWebhookAssignee(ctx, "assigned"),
		unassigned: ctx => this.mapWebhookAssignee(ctx, "unassigned"),
		labeled: ctx => this.mapWebhookLabel(ctx, "labeled"),
		unlabeled: ctx => this.mapWebhookLabel(ctx, "unlabeled"),
		typed: ctx => this.mapWebhookType(ctx, "typed"),
		untyped: ctx => this.mapWebhookType(ctx, "untyped")
	}

	private async normalizePolling(
		event: RawEventDocument
	): Promise<NormalizedEventDocument | null> {
		const { repository, owner, issue, item } = event.payload as {
			repository: GetIssueTimelineResult["repository"]
			owner: GetIssueTimelineResult["owner"]
			issue: PollingIssue
			item: PollingTimelineItem
		}

		if (
			!hasTypename(item, [
				"ClosedEvent",
				"ReopenedEvent",
				"LabeledEvent",
				"UnlabeledEvent",
				"AssignedEvent",
				"UnassignedEvent",
				"IssueTypeAddedEvent",
				"IssueTypeChangedEvent",
				"IssueTypeRemovedEvent",
				"IssueComment",
				"CommentDeletedEvent"
			])
		) {
			return null
		}

		const supportedItem = item as SupportedPollingTimelineItem

		const eventKey = `issue.timeline:${supportedItem.id}`
		const mapper = this.pollingMappers[supportedItem.__typename]

		if (!mapper) {
			throw new Error(
				`Unsupported issue timeline typename: ${supportedItem.__typename}`
			)
		}

		const query = mapper({
			item: supportedItem,
			issue,
			base: this.buildPollingBaseQuery(eventKey, repository, owner)
		})
		if (!query) {
			return null
		}

		return await this.upsert(eventKey, query)
	}

	private async normalizeWebhook(
		event: RawEventDocument
	): Promise<NormalizedEventDocument | null> {
		const payload = event.payload as WebhookIssuesPayload
		const eventKey = `issue_timeline:${event.source_id}`
		const mapper = this.webhookMappers[payload.action]

		if (!mapper) {
			throw new Error(`Unsupported issue action: ${payload.action}`)
		}

		const query = mapper({
			event,
			payload,
			base: this.buildWebhookBaseQuery(eventKey, payload.repository)
		})
		if (!query) {
			return null
		}

		return await this.upsert(eventKey, query)
	}

	private mapPollingStateChanged(
		ctx: PollingContext,
		eventType: "closed" | "reopened"
	): NormalizedEvent | null {
		const { item, issue, base } = ctx

		if (!hasTypename(item, ["ClosedEvent", "ReopenedEvent"])) {
			return null
		}
		const actor = this.requireUserActor(item.actor)
		if (!actor) return null

		return {
			...base,
			event_type: "issue.state_changed",
			payload: {
				eventId: item.id,
				event: eventType,
				actor,
				issueId: issue.id,
				createdAt: new Date(item.createdAt)
			} satisfies ExtractEvent<"issue.state_changed">["payload"]
		}
	}

	private mapPollingLabel(
		ctx: PollingContext,
		eventType: "labeled" | "unlabeled"
	): NormalizedEvent | null {
		const { item, issue, base } = ctx

		if (!hasTypename(item, ["LabeledEvent", "UnlabeledEvent"])) {
			return null
		}
		const actor = this.requireUserActor(item.actor)
		if (!actor) return null

		return {
			...base,
			event_type: "issue.labeled",
			payload: {
				eventId: item.id,
				event: eventType,
				actor,
				label: item.label.name,
				issueId: issue.id,
				createdAt: new Date(item.createdAt)
			} satisfies ExtractEvent<"issue.labeled">["payload"]
		}
	}

	private mapPollingAssignee(
		ctx: PollingContext,
		eventType: "assigned" | "unassigned"
	): NormalizedEvent | null {
		const { item, issue, base } = ctx

		if (!hasTypename(item, ["AssignedEvent", "UnassignedEvent"])) {
			return null
		}

		if (!hasTypename(item.assignee, ["User"])) {
			return null
		}
		const actor = this.requireUserActor(item.actor)
		if (!actor) return null

		return {
			...base,
			event_type: "issue.assigned",
			payload: {
				eventId: item.id,
				event: eventType,
				actor,
				assignee: {
					id: item.assignee.id,
					login: item.assignee.login
				},
				issueId: issue.id,
				createdAt: new Date(item.createdAt)
			} satisfies ExtractEvent<"issue.assigned">["payload"]
		}
	}

	private mapPollingType(
		ctx: PollingContext,
		eventType: "typed" | "untyped"
	): NormalizedEvent | null {
		const { item, issue, base } = ctx

		if (
			!hasTypename(item, [
				"IssueTypeAddedEvent",
				"IssueTypeChangedEvent",
				"IssueTypeRemovedEvent"
			])
		) {
			return null
		}
		const actor = this.requireUserActor(item.actor)
		if (!actor) return null

		return {
			...base,
			event_type: "issue.typed",
			payload: {
				eventId: item.id,
				event: eventType,
				actor,
				type: item.issueType?.name ?? "unknown",
				issueId: issue.id,
				createdAt: new Date(item.createdAt)
			} satisfies ExtractEvent<"issue.typed">["payload"]
		}
	}

	private mapPollingComment(ctx: PollingContext): NormalizedEvent | null {
		const { item, issue, base } = ctx

		if (!hasTypename(item, ["IssueComment"])) {
			return null
		}

		if (!hasTypename(item.author, ["User"])) {
			return null
		}

		return {
			...base,
			event_type: "issue.commented",
			payload: {
				eventId: item.id,
				issueId: issue.id,
				actor: {
					id: item.author.id,
					login: item.author.login
				},
				event: "commented",
				body: item.body,
				createdAt: new Date(item.createdAt),
				updatedAt: new Date(item.createdAt)
			} satisfies ExtractEvent<"issue.commented">["payload"]
		}
	}

	private requireUserActor(actor: unknown): UserActor | null {
		const actorNode = actor as
			| { __typename?: string; id?: string; login?: string }
			| null
			| undefined
		if (actorNode?.__typename !== "User" || !actorNode.id || !actorNode.login) {
			return null
		}

		return {
			id: actorNode.id,
			login: actorNode.login
		}
	}

	private mapPollingCommentDeleted(ctx: PollingContext): NormalizedEvent | null {
		const { item, issue, base } = ctx

		if (!hasTypename(item, ["CommentDeletedEvent"])) {
			return null
		}

		if (!hasTypename(item.actor, ["User"])) {
			return null
		}

		return {
			...base,
			event_type: "issue.commented",
			payload: {
				eventId: item.id,
				issueId: issue.id,
				actor: {
					id: item.actor.id,
					login: item.actor.login
				},
				event: "commented",
				body: "",
				createdAt: new Date(item.createdAt),
				updatedAt: new Date(item.createdAt)
			} satisfies ExtractEvent<"issue.commented">["payload"]
		}
	}

	private mapWebhookStateChanged(
		ctx: WebhookContext,
		eventType: "closed" | "reopened"
	): NormalizedEvent {
		const { event, payload, base } = ctx
		const issuePayload = payload as
			| EmitterWebhookEvent<"issues.closed">["payload"]
			| EmitterWebhookEvent<"issues.reopened">["payload"]

		return {
			...base,
			event_type: "issue.state_changed",
			payload: {
				eventId: event.source_id,
				event: eventType,
				actor: {
					id: issuePayload.issue.user!.node_id!,
					login: issuePayload.issue.user!.login
				},
				issueId: issuePayload.issue.node_id,
				createdAt: new Date(event.received_at)
			} satisfies ExtractEvent<"issue.state_changed">["payload"]
		}
	}

	private mapWebhookAssignee(
		ctx: WebhookContext,
		eventType: "assigned" | "unassigned"
	): NormalizedEvent {
		const { event, payload, base } = ctx
		const issuePayload = payload as
			| EmitterWebhookEvent<"issues.assigned">["payload"]
			| EmitterWebhookEvent<"issues.unassigned">["payload"]

		return {
			...base,
			event_type: "issue.assigned",
			payload: {
				eventId: event.source_id,
				event: eventType,
				actor: {
					id: issuePayload.issue.user!.node_id!,
					login: issuePayload.issue.user!.login
				},
				assignee: {
					id: issuePayload.assignee!.node_id!,
					login: issuePayload.assignee!.login
				},
				issueId: issuePayload.issue.node_id,
				createdAt: new Date(event.received_at)
			} satisfies ExtractEvent<"issue.assigned">["payload"]
		}
	}

	private mapWebhookLabel(
		ctx: WebhookContext,
		eventType: "labeled" | "unlabeled"
	): NormalizedEvent {
		const { event, payload, base } = ctx
		const issuePayload = payload as
			| EmitterWebhookEvent<"issues.labeled">["payload"]
			| EmitterWebhookEvent<"issues.unlabeled">["payload"]

		return {
			...base,
			event_type: "issue.labeled",
			payload: {
				eventId: event.source_id,
				event: eventType,
				actor: {
					id: issuePayload.issue.user!.node_id!,
					login: issuePayload.issue.user!.login
				},
				label: issuePayload.label!.name,
				issueId: issuePayload.issue.node_id,
				createdAt: new Date(event.received_at)
			} satisfies ExtractEvent<"issue.labeled">["payload"]
		}
	}

	private mapWebhookType(
		ctx: WebhookContext,
		eventType: "typed" | "untyped"
	): NormalizedEvent {
		const { event, payload, base } = ctx
		const issuePayload = payload as
			| EmitterWebhookEvent<"issues.typed">["payload"]
			| EmitterWebhookEvent<"issues.untyped">["payload"]

		return {
			...base,
			event_type: "issue.typed",
			payload: {
				eventId: event.source_id,
				issueId: issuePayload.issue.node_id,
				event: eventType,
				actor: {
					id: issuePayload.issue.user!.node_id!,
					login: issuePayload.issue.user!.login
				},
				type: issuePayload.type?.name ?? "unknown",
				createdAt: new Date(event.received_at)
			} satisfies ExtractEvent<"issue.typed">["payload"]
		}
	}

	private buildPollingBaseQuery(
		eventKey: string,
		repository: GetIssueTimelineResult["repository"],
		owner: GetIssueTimelineResult["owner"]
	): Pick<
		NormalizedEvent,
		"event_key" | "source" | "repository" | "repositoryOwner"
	> {
		return {
			event_key: eventKey,
			source: "github",
			repository,
			repositoryOwner: {
				id: owner.id,
				name: owner.login,
				url: owner.url,
				avatarUrl: owner.avatarUrl
			}
		}
	}

	private buildWebhookBaseQuery(
		eventKey: string,
		repository: WebhookIssuesPayload["repository"]
	): Pick<
		NormalizedEvent,
		"event_key" | "source" | "repository" | "repositoryOwner"
	> {
		return {
			event_key: eventKey,
			source: "github",
			repository: this.buildWebhookRepository(repository),
			repositoryOwner: this.buildWebhookRepositoryOwner(repository)
		}
	}
}
