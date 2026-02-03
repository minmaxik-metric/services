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
	GetPullRequestReviewsResult,
	GetPullRequestsResult
} from "../../github/api/github-api.service"

import { BaseNormalizer } from "./base.normalizer"
import { EventNormalizer } from "./types"

@Injectable()
export class PullRequestReviewNormalizer
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
				const { repository, owner, pullRequest, review } = event.payload as {
					repository: GetPullRequestReviewsResult["repository"]
					owner: GetPullRequestReviewsResult["owner"]
					pullRequest: NonNullable<
						GetPullRequestsResult["pullRequests"][number]
					>
					review: NonNullable<GetPullRequestReviewsResult["reviews"][number]>
				}

				const eventKey = `pr.review:${review.id}`

				if (!hasTypename(review.author, ["User"])) {
					return null
				}

				const query: NormalizedEvent = {
					event_key: eventKey,
					event_type: "pull_request.reviewed",
					source: "github",
					repository,
					repositoryOwner: {
						id: owner.id,
						name: owner.login,
						url: owner.url,
						avatarUrl: owner.avatarUrl
					},
					payload: {
						eventId: review.id,
						prId: pullRequest.id,
						event: "reviewed",
						actor: {
							id: review.author.id,
							login: review.author.login
						},
						body: review.body,
						createdAt: new Date(review.createdAt),
						updatedAt: new Date(review.createdAt)
					} as ExtractEvent<"pull_request.reviewed">["payload"]
				}

				return await this.upsert(eventKey, query)
			}
			case "webhook": {
				const { repository, pull_request, review } =
					event.payload as EmitterWebhookEvent<"pull_request_review">["payload"]

				const eventKey = `pr.review:${review.node_id}`

				const query: NormalizedEvent = {
					event_key: eventKey,
					event_type: "pull_request.reviewed",
					source: "github",
					repository: this.buildWebhookRepository(repository),
					repositoryOwner: this.buildWebhookRepositoryOwner(repository),
					payload: {
						eventId: review.node_id,
						prId: pull_request.node_id,
						event: "reviewed",
						actor: {
							id: review.user!.node_id,
							login: review.user!.login
						},
						body: review.body || "",
						createdAt: new Date(review.submitted_at!),
						updatedAt: new Date(review.submitted_at!)
					} as ExtractEvent<"pull_request.reviewed">["payload"]
				}

				return await this.upsert(eventKey, query)
			}
		}
	}
}
