import { ExtractEvent } from "@citec-spbu/contracts"
import { Injectable } from "@nestjs/common"
import { EmitterWebhookEvent } from "@octokit/webhooks"

import { MongoService } from "@/infrastructure/mongo/mongodb.service"
import { RawEventDocument } from "@/infrastructure/mongo/schemas"
import {
	NormalizedEvent,
	NormalizedEventDocument
} from "@/infrastructure/mongo/schemas/normalized-events.schema"
import { GetPullRequestReviewsResult } from "@/modules/github/api/github-api.service"
import { hasTypename } from "@/modules/github/api/helpers"

import { BaseNormalizer } from "./base.normalizer"
import { EventNormalizer } from "./types"

@Injectable()
export class PullRequestReviewCommentNormalizer
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
		const { repository, owner, review, comment } = event.payload as {
			repository: GetPullRequestReviewsResult["repository"]
			owner: GetPullRequestReviewsResult["owner"]
			review: NonNullable<GetPullRequestReviewsResult["reviews"][number]>
			comment: NonNullable<
				NonNullable<
					NonNullable<
						GetPullRequestReviewsResult["reviews"][number]
					>["comments"]["nodes"]
				>[number]
			>
		}

		const eventKey = `pr.comment:${comment.id}`

		if (!hasTypename(comment.author, ["User"])) {
			return null
		}

		const query: NormalizedEvent = {
			event_key: eventKey,
			event_type: "pull_request.commented",
			source: "github",
			repository,
			repositoryOwner: {
				id: owner.id,
				name: owner.login,
				url: owner.url,
				avatarUrl: owner.avatarUrl
			},
			payload: {
				eventId: comment.id,
				prId: review.id,
				event: "commented",
				actor: comment.author,
				body: comment.body ?? "",
				createdAt: new Date(comment.createdAt),
				updatedAt: new Date(comment.updatedAt)
			} satisfies ExtractEvent<"pull_request.commented">["payload"]
		}

		return await this.upsert(eventKey, query)
	}

	private async normalizeWebhook(
		event: RawEventDocument
	): Promise<NormalizedEventDocument> {
		const { repository, pull_request, comment, sender } =
			event.payload as EmitterWebhookEvent<"pull_request_review_comment">["payload"]

		const eventKey = `pr.comment:${comment.node_id}`
		const actor = comment.user ?? sender

		if (!actor) {
			throw new Error("Pull request review comment actor is missing")
		}

		const query: NormalizedEvent = {
			event_key: eventKey,
			event_type: "pull_request.commented",
			source: "github",
			repository: this.buildWebhookRepository(repository),
			repositoryOwner: this.buildWebhookRepositoryOwner(repository),
			payload: {
				eventId: comment.node_id ?? event.source_id,
				prId: pull_request.node_id,
				event: "commented",
				actor: {
					id: actor.node_id!,
					login: actor.login
				},
				body: comment.body ?? "",
				createdAt: new Date(comment.created_at),
				updatedAt: new Date(comment.updated_at ?? comment.created_at)
			} satisfies ExtractEvent<"pull_request.commented">["payload"]
		}

		return await this.upsert(eventKey, query)
	}
}
