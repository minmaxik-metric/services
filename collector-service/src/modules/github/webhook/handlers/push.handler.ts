import { BadRequestException, Injectable, Logger } from "@nestjs/common"
import { EmitterWebhookEvent } from "@octokit/webhooks"

import { MongoService } from "@/infrastructure/mongo/mongodb.service"
import { RawEvent } from "@/infrastructure/mongo/schemas"
import { NormalizeService } from "@/modules/normalize/normalize.service"

import { GithubApiService } from "../../api/github-api.service"
import { GithubActiveRepositoriesService } from "../../repositories/github-active-repositories.service"
import { mapWebhookRepository } from "../../repositories/github-repository-tracking.mapper"

@Injectable()
export class PushGithubWebhookHandler {
	private readonly logger = new Logger(PushGithubWebhookHandler.name)

	public constructor(
		private readonly mongoService: MongoService,
		private readonly apiService: GithubApiService,
		private readonly normalizeService: NormalizeService,
		private readonly activeRepositoriesService: GithubActiveRepositoriesService
	) {}

	public async handle(payload: EmitterWebhookEvent<"push">["payload"]) {
		const { repository, commits, sender } = payload

		if (!sender) {
			throw new BadRequestException("No author of commit provided")
		}

		if (!repository.owner) {
			throw new BadRequestException("No repository owner provided")
		}

		if (!commits) {
			throw new BadRequestException("No commits provided")
		}

		await this.activeRepositoriesService.touchRepositoryActivity(
			mapWebhookRepository(repository),
			"push",
			this.getPushActivityAt(payload)
		)

		let processedCommits = 0

		for (const commit of commits) {
			const detailedCommit = await this.apiService.getDetailedCommit(
				repository.owner.login,
				repository.name,
				commit.id
			)

			const query: RawEvent = {
				source: "github",
				source_id: commit.id,

				method: "webhook",
				event_type: "commit",
				repository: repository.full_name,
				payload: { repository, commit: detailedCommit }
			}

			const event = await this.mongoService.rawEvents.findOneAndUpdate(
				{
					source: "github",
					source_id: commit.id,
					method: "webhook"
				},
				{
					$setOnInsert: query
				},
				{ upsert: true, returnDocument: "after", includeResultMetadata: true }
			)

			if (event.lastErrorObject?.upserted && event.value) {
				processedCommits++

				await this.normalizeService.createAndPublishEvent(event.value)
			}
		}
		this.logger.log(`Successfully processed ${processedCommits} commit(s).`)
	}

	private getPushActivityAt(payload: EmitterWebhookEvent<"push">["payload"]) {
		if (payload.head_commit?.timestamp) {
			return new Date(payload.head_commit.timestamp)
		}

		return new Date()
	}
}
