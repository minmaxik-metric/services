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

import { PullRequestState } from "../../github/api/generated/graphql"
import { GetPullRequestsResult } from "../../github/api/github-api.service"

import { BaseNormalizer } from "./base.normalizer"
import { EventNormalizer } from "./types"

@Injectable()
export class PullRequestNormalizer
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
		const { repository, owner, pullRequest } = event.payload as {
			repository: GetPullRequestsResult["repository"]
			owner: GetPullRequestsResult["owner"]
			pullRequest: NonNullable<GetPullRequestsResult["pullRequests"][number]>
		}

		const eventKey = `pr:${pullRequest.id}`

		if (!hasTypename(pullRequest.author, ["User"])) {
			return null
		}

		const query: NormalizedEvent = {
			event_key: eventKey,
			event_type: "pull_request.created",
			source: "github",
			repository,
			repositoryOwner: {
				id: owner.id,
				name: owner.login,
				url: owner.url,
				avatarUrl: owner.avatarUrl
			},
			payload: {
				id: pullRequest.id,
				number: pullRequest.number,
				name: pullRequest.title,
				description: pullRequest.body,
				state: pullRequest.state === PullRequestState.Open ? "open" : "closed",
				author: {
					id: pullRequest.author.id,
					login: pullRequest.author.login
				},
				commentCount: pullRequest.comments.totalCount,
				additions: pullRequest.additions,
				deletions: pullRequest.deletions,
				createdAt: new Date(pullRequest.createdAt),
				updatedAt: new Date(pullRequest.updatedAt),
				closedAt: pullRequest.closedAt ? new Date(pullRequest.closedAt) : null
			} satisfies ExtractEvent<"pull_request.created">["payload"]
		}

		return await this.upsert(eventKey, query)
	}

	private async normalizeWebhook(
		event: RawEventDocument
	): Promise<NormalizedEventDocument | null> {
		const { repository, pull_request } =
			event.payload as EmitterWebhookEvent<"pull_request">["payload"]

		const eventKey = `pr:${pull_request.node_id}`

		const query: NormalizedEvent = {
			event_key: eventKey,
			event_type: "pull_request.created",
			source: "github",
			repository: this.buildWebhookRepository(repository),
			repositoryOwner: this.buildWebhookRepositoryOwner(repository),
			payload: {
				id: pull_request.node_id,
				number: pull_request.number,
				name: pull_request.title,
				description: pull_request.body,
				state: pull_request.state === "open" ? "open" : "closed",
				author: {
					id: pull_request.user!.node_id!,
					login: pull_request.user!.login
				},
				commentCount: pull_request.comments!,
				additions: pull_request.additions!,
				deletions: pull_request.deletions!,
				createdAt: new Date(pull_request.created_at),
				updatedAt: new Date(pull_request.updated_at),
				closedAt: pull_request.closed_at
					? new Date(pull_request.closed_at)
					: null
			} satisfies ExtractEvent<"pull_request.created">["payload"]
		}

		return await this.upsert(eventKey, query)
	}
}
