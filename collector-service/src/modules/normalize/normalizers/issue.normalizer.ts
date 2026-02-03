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

import { IssueState } from "../../github/api/generated/graphql"
import { GetIssuesResult } from "../../github/api/github-api.service"

import { BaseNormalizer } from "./base.normalizer"
import { EventNormalizer } from "./types"

@Injectable()
export class IssueNormalizer extends BaseNormalizer implements EventNormalizer {
	public constructor(mongoService: MongoService) {
		super(mongoService)
	}

	public async normalize(
		event: RawEventDocument
	): Promise<NormalizedEventDocument | null> {
		switch (event.method) {
			case "manual":
			case "polling": {
				return await this.normalizePolling(event)
			}
			case "webhook": {
				return await this.normalizeWebhook(event)
			}
		}
	}

	private async normalizePolling(
		event: RawEventDocument
	): Promise<NormalizedEventDocument | null> {
		const { repository, owner, issue } = event.payload as {
			repository: GetIssuesResult["repository"]
			owner: GetIssuesResult["owner"]
			issue: NonNullable<GetIssuesResult["issues"][number]>
		}

		const eventKey = `issue:${issue.id}`

		if (!hasTypename(issue.author, ["User"])) {
			return null
		}

		const query: NormalizedEvent = {
			event_key: eventKey,
			event_type: "issue.created",
			source: "github",
			repository,
			repositoryOwner: {
				id: owner.id,
				name: owner.login,
				url: owner.url,
				avatarUrl: owner.avatarUrl
			},
			payload: {
				id: issue.id,
				number: issue.number,
				author: {
					id: issue.author.id,
					login: issue.author.login
				},
				title: issue.title,
				description: issue.body,
				state: issue.state === IssueState.Open ? "open" : "deleted",
				commentCount: issue.comments.totalCount,
				createdAt: new Date(issue.createdAt),
				closedAt: issue.closedAt ? new Date(issue.closedAt) : null
			} satisfies ExtractEvent<"issue.created">["payload"]
		}

		return await this.upsert(eventKey, query)
	}

	private async normalizeWebhook(
		event: RawEventDocument
	): Promise<NormalizedEventDocument | null> {
		const { repository, issue } =
			event.payload as EmitterWebhookEvent<"issues">["payload"]

		const eventKey = `issue:${issue.node_id}`

		const query: NormalizedEvent = {
			event_key: eventKey,
			event_type: "issue.created",
			source: "github",
			repository: this.buildWebhookRepository(repository),
			repositoryOwner: this.buildWebhookRepositoryOwner(repository),
			payload: {
				id: issue.node_id,
				number: issue.number,
				author: {
					id: issue.user!.node_id!,
					login: issue.user!.login
				},
				title: issue.title,
				description: issue.body,
				state: issue.state === "open" ? "open" : "deleted",
				commentCount: 0,
				createdAt: new Date(issue.created_at),
				closedAt: issue.closed_at ? new Date(issue.closed_at) : null
			} satisfies ExtractEvent<"issue.created">["payload"]
		}

		return await this.upsert(eventKey, query)
	}
}
