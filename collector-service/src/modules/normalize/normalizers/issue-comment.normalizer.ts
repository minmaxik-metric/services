import { ExtractEvent } from "@citec-spbu/contracts"
import { Injectable } from "@nestjs/common"
import { EmitterWebhookEvent } from "@octokit/webhooks"

import { MongoService } from "@/infrastructure/mongo/mongodb.service"
import { RawEventDocument } from "@/infrastructure/mongo/schemas"
import {
	NormalizedEvent,
	NormalizedEventDocument
} from "@/infrastructure/mongo/schemas/normalized-events.schema"

import { BaseNormalizer } from "./base.normalizer"
import { EventNormalizer } from "./types"

@Injectable()
export class IssueCommentNormalizer
	extends BaseNormalizer
	implements EventNormalizer
{
	public constructor(mongoService: MongoService) {
		super(mongoService)
	}

	public async normalize(
		event: RawEventDocument
	): Promise<NormalizedEventDocument> {
		if (event.method !== "webhook") {
			throw new Error(`Unsupported comment source method: ${event.method}`)
		}

		const { repository, issue, comment, sender } =
			event.payload as EmitterWebhookEvent<"issue_comment">["payload"]
		const actor = comment.user ?? sender

		if (!actor) {
			throw new Error("Issue comment actor is missing")
		}

		const eventKey = `issue.comment:${comment.node_id}`

		const query: NormalizedEvent = {
			event_key: eventKey,
			event_type: "issue.commented",
			source: "github",
			repository: this.buildWebhookRepository(repository),
			repositoryOwner: this.buildWebhookRepositoryOwner(repository),
			payload: {
				eventId: comment.node_id,
				issueId: issue.node_id,
				actor: {
					id: actor.node_id!,
					login: actor.login
				},
				event: "commented",
				body: comment.body ?? "",
				createdAt: new Date(comment.created_at),
				updatedAt: new Date(comment.updated_at ?? comment.created_at)
			} satisfies ExtractEvent<"issue.commented">["payload"]
		}

		return await this.upsert(eventKey, query)
	}
}
