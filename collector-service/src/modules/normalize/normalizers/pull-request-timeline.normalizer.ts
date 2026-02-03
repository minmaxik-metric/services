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
	GetPullRequestsResult,
	GetPullRequestTimelineResult
} from "../../github/api/github-api.service"

import { BaseNormalizer } from "./base.normalizer"
import { EventNormalizer } from "./types"

type PullRequest = NonNullable<GetPullRequestsResult["pullRequests"][number]>
type TimelineItem = NonNullable<
	GetPullRequestTimelineResult["timeline"][number]
>
type WebhookPullRequestPayload = EmitterWebhookEvent<"pull_request">["payload"]

type SupportedPollingTimelineItem = Extract<
	TimelineItem,
	{
		__typename:
			| "ClosedEvent"
			| "ReopenedEvent"
			| "MergedEvent"
			| "LabeledEvent"
			| "UnlabeledEvent"
			| "AssignedEvent"
			| "UnassignedEvent"
			| "ReviewRequestedEvent"
			| "IssueComment"
			| "CommentDeletedEvent"
	}
>

type UserActor = { id: string; login: string }

type PollingContext = {
	item: SupportedPollingTimelineItem
	pullRequest: PullRequest
	base: Pick<
		NormalizedEvent,
		"event_key" | "source" | "repository" | "repositoryOwner"
	>
}

type WebhookContext = {
	event: RawEventDocument
	payload: WebhookPullRequestPayload
	base: Pick<
		NormalizedEvent,
		"event_key" | "source" | "repository" | "repositoryOwner"
	>
}

@Injectable()
export class PullRequestTimelineNormalizer
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
		SupportedPollingTimelineItem["__typename"],
		(ctx: PollingContext) => NormalizedEvent | null
	> = {
		ClosedEvent: ctx => this.mapPollingStateChanged(ctx, "closed"),
		ReopenedEvent: ctx => this.mapPollingStateChanged(ctx, "reopened"),
		MergedEvent: ctx => this.mapPollingStateChanged(ctx, "merged"),
		LabeledEvent: ctx => this.mapPollingLabel(ctx, "labeled"),
		UnlabeledEvent: ctx => this.mapPollingLabel(ctx, "unlabeled"),
		AssignedEvent: ctx => this.mapPollingAssignee(ctx, "assigned"),
		UnassignedEvent: ctx => this.mapPollingAssignee(ctx, "unassigned"),
		ReviewRequestedEvent: ctx => this.mapPollingReviewRequested(ctx),
		IssueComment: ctx => this.mapPollingComment(ctx),
		CommentDeletedEvent: ctx => this.mapPollingCommentDeleted(ctx)
	}

	private readonly webhookMappers: Record<
		| "closed"
		| "reopened"
		| "assigned"
		| "unassigned"
		| "labeled"
		| "unlabeled"
		| "review_requested"
		| "review_request_removed",
		(ctx: WebhookContext) => NormalizedEvent | null
	> = {
		closed: ctx => this.mapWebhookStateChanged(ctx, "closed"),
		reopened: ctx => this.mapWebhookStateChanged(ctx, "reopened"),
		assigned: ctx => this.mapWebhookAssignee(ctx, "assigned"),
		unassigned: ctx => this.mapWebhookAssignee(ctx, "unassigned"),
		labeled: ctx => this.mapWebhookLabel(ctx, "labeled"),
		unlabeled: ctx => this.mapWebhookLabel(ctx, "unlabeled"),
		review_requested: ctx => this.mapWebhookReviewRequested(ctx),
		review_request_removed: ctx => this.mapWebhookReviewRequested(ctx)
	}

	private async normalizePolling(
		event: RawEventDocument
	): Promise<NormalizedEventDocument | null> {
		const { repository, owner, pullRequest, item } = event.payload as {
			repository: GetPullRequestTimelineResult["repository"]
			owner: GetPullRequestTimelineResult["owner"]
			pullRequest: PullRequest
			item: TimelineItem
		}

		if (
			!hasTypename(item, [
				"ClosedEvent",
				"ReopenedEvent",
				"MergedEvent",
				"LabeledEvent",
				"UnlabeledEvent",
				"AssignedEvent",
				"UnassignedEvent",
				"ReviewRequestedEvent",
				"IssueComment",
				"CommentDeletedEvent"
			])
		) {
			return null
		}

		const eventKey = `pr.timeline:${item.id}`
		const mapper = this.pollingMappers[item.__typename]

		if (!mapper) {
			throw new Error(
				`Unsupported pull request timeline typename: ${item.__typename}`
			)
		}

		const query = mapper({
			item,
			pullRequest,
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
		const payload = event.payload as WebhookPullRequestPayload
		const action = payload.action as keyof typeof this.webhookMappers
		const mapper = this.webhookMappers[action]

		if (!mapper) {
			throw new Error(`Unsupported pull request action: ${payload.action}`)
		}

		const eventKey = `pr_timeline:${event.source_id}`
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
		eventType: "closed" | "reopened" | "merged"
	): NormalizedEvent | null {
		const { item, pullRequest, base } = ctx

		if (!hasTypename(item, ["ClosedEvent", "ReopenedEvent", "MergedEvent"])) {
			return null
		}

		const actor = this.requireUserActor(item.actor)
		if (!actor) return null

		return {
			...base,
			event_type: "pull_request.state_changed",
			payload: {
				eventId: item.id,
				event: eventType,
				actor,
				prId: pullRequest.id,
				createdAt: new Date(item.createdAt)
			} satisfies ExtractEvent<"pull_request.state_changed">["payload"]
		}
	}

	private mapPollingLabel(
		ctx: PollingContext,
		eventType: "labeled" | "unlabeled"
	): NormalizedEvent | null {
		const { item, pullRequest, base } = ctx

		if (!hasTypename(item, ["LabeledEvent", "UnlabeledEvent"])) {
			return null
		}

		const actor = this.requireUserActor(item.actor)
		if (!actor) return null

		return {
			...base,
			event_type: "pull_request.labeled",
			payload: {
				eventId: item.id,
				event: eventType,
				actor,
				label: item.label.name,
				prId: pullRequest.id,
				createdAt: new Date(item.createdAt)
			} satisfies ExtractEvent<"pull_request.labeled">["payload"]
		}
	}

	private mapPollingAssignee(
		ctx: PollingContext,
		eventType: "assigned" | "unassigned"
	): NormalizedEvent | null {
		const { item, pullRequest, base } = ctx

		if (!hasTypename(item, ["AssignedEvent", "UnassignedEvent"])) {
			return null
		}

		const actor = this.requireUserActor(item.actor)
		if (!actor) return null
		if (!hasTypename(item.assignee, ["User"])) {
			return null
		}

		return {
			...base,
			event_type: "pull_request.assigned",
			payload: {
				eventId: item.id,
				event: eventType,
				actor,
				assignee: {
					id: item.assignee.id,
					login: item.assignee.login
				},
				prId: pullRequest.id,
				createdAt: new Date(item.createdAt)
			} satisfies ExtractEvent<"pull_request.assigned">["payload"]
		}
	}

	private mapPollingReviewRequested(ctx: PollingContext): NormalizedEvent | null {
		const { item, pullRequest, base } = ctx

		if (!hasTypename(item, ["ReviewRequestedEvent"])) {
			return null
		}

		const actor = this.requireUserActor(item.actor)
		if (!actor) return null
		if (!hasTypename(item.requestedReviewer, ["User"])) {
			return null
		}

		return {
			...base,
			event_type: "pull_request.review_requested",
			payload: {
				eventId: item.id,
				event: "review_requested",
				actor,
				requestedReviewer: {
					id: item.requestedReviewer.id,
					login: item.requestedReviewer.login
				},
				prId: pullRequest.id,
				createdAt: new Date(item.createdAt)
			} satisfies ExtractEvent<"pull_request.review_requested">["payload"]
		}
	}

	private mapPollingComment(ctx: PollingContext): NormalizedEvent | null {
		const { item, pullRequest, base } = ctx

		if (!hasTypename(item, ["IssueComment"])) {
			return null
		}

		if (!hasTypename(item.author, ["User"])) {
			return null
		}

		return {
			...base,
			event_type: "pull_request.commented",
			payload: {
				eventId: item.id,
				prId: pullRequest.id,
				event: "commented",
				actor: {
					id: item.author.id,
					login: item.author.login
				},
				body: item.body,
				createdAt: new Date(item.createdAt),
				updatedAt: new Date(item.createdAt)
			} satisfies ExtractEvent<"pull_request.commented">["payload"]
		}
	}

	private mapPollingCommentDeleted(ctx: PollingContext): NormalizedEvent | null {
		const { item, pullRequest, base } = ctx

		if (!hasTypename(item, ["CommentDeletedEvent"])) {
			return null
		}

		const actor = this.requireUserActor(item.actor)
		if (!actor) return null

		return {
			...base,
			event_type: "pull_request.commented",
			payload: {
				eventId: item.id,
				prId: pullRequest.id,
				event: "commented",
				actor,
				body: "",
				createdAt: new Date(item.createdAt),
				updatedAt: new Date(item.createdAt)
			} satisfies ExtractEvent<"pull_request.commented">["payload"]
		}
	}

	private mapWebhookStateChanged(
		ctx: WebhookContext,
		eventType: "closed" | "reopened"
	): NormalizedEvent | null {
		const { event, payload, base } = ctx
		const typedPayload = payload as
			| EmitterWebhookEvent<"pull_request.closed">["payload"]
			| EmitterWebhookEvent<"pull_request.reopened">["payload"]

		const derivedState =
			eventType === "reopened"
				? "reopened"
				: typedPayload.pull_request.merged
					? "merged"
					: "closed"
		const actor = this.requireWebhookUser(
			typedPayload.pull_request.user,
			"pull_request.user"
		)
		if (!actor) return null

		return {
			...base,
			event_type: "pull_request.state_changed",
			payload: {
				eventId: event.source_id,
				event: derivedState,
				actor,
				prId: typedPayload.pull_request.node_id,
				createdAt: new Date(event.received_at)
			} satisfies ExtractEvent<"pull_request.state_changed">["payload"]
		}
	}

	private mapWebhookAssignee(
		ctx: WebhookContext,
		eventType: "assigned" | "unassigned"
	): NormalizedEvent | null {
		const { event, payload, base } = ctx
		const typedPayload = payload as
			| EmitterWebhookEvent<"pull_request.assigned">["payload"]
			| EmitterWebhookEvent<"pull_request.unassigned">["payload"]
		const actor = this.requireWebhookUser(
			typedPayload.pull_request.user,
			"pull_request.user"
		)
		const assignee = this.requireWebhookUser(typedPayload.assignee, "assignee")
		if (!actor || !assignee) return null

		return {
			...base,
			event_type: "pull_request.assigned",
			payload: {
				eventId: event.source_id,
				event: eventType,
				actor,
				assignee,
				prId: typedPayload.pull_request.node_id,
				createdAt: new Date(event.received_at)
			} satisfies ExtractEvent<"pull_request.assigned">["payload"]
		}
	}

	private mapWebhookLabel(
		ctx: WebhookContext,
		eventType: "labeled" | "unlabeled"
	): NormalizedEvent | null {
		const { event, payload, base } = ctx
		const typedPayload = payload as
			| EmitterWebhookEvent<"pull_request.labeled">["payload"]
			| EmitterWebhookEvent<"pull_request.unlabeled">["payload"]
		const actor = this.requireWebhookUser(
			typedPayload.pull_request.user,
			"pull_request.user"
		)
		if (!actor) return null

		return {
			...base,
			event_type: "pull_request.labeled",
			payload: {
				eventId: event.source_id,
				event: eventType,
				actor,
				label: typedPayload.label!.name,
				prId: typedPayload.pull_request.node_id,
				createdAt: new Date(event.received_at)
			} satisfies ExtractEvent<"pull_request.labeled">["payload"]
		}
	}

	private mapWebhookReviewRequested(ctx: WebhookContext): NormalizedEvent | null {
		const { event, payload, base } = ctx
		const typedPayload = payload as
			| EmitterWebhookEvent<"pull_request.review_requested">["payload"]
			| EmitterWebhookEvent<"pull_request.review_request_removed">["payload"]
		const actor = this.requireWebhookUser(
			typedPayload.pull_request.user,
			"pull_request.user"
		)
		const requestedReviewer = this.requireWebhookUser(
			typedPayload.requested_reviewer,
			"requested_reviewer"
		)
		if (!actor || !requestedReviewer) return null

		return {
			...base,
			event_type: "pull_request.review_requested",
			payload: {
				eventId: event.source_id,
				event: "review_requested",
				actor,
				requestedReviewer,
				prId: typedPayload.pull_request.node_id,
				createdAt: new Date(event.received_at)
			} satisfies ExtractEvent<"pull_request.review_requested">["payload"]
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

	private requireWebhookUser(
		user:
			| {
					node_id?: string
					login: string
			  }
			| null
			| undefined,
		label: string
	): UserActor | null {
		if (!user?.node_id) {
			return null
		}

		return {
			id: user.node_id,
			login: user.login
		}
	}

	private buildPollingBaseQuery(
		eventKey: string,
		repository: GetPullRequestTimelineResult["repository"],
		owner: GetPullRequestTimelineResult["owner"]
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
		repository: WebhookPullRequestPayload["repository"]
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
