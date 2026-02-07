import { BadRequestException, Injectable, Logger } from "@nestjs/common"
import { EmitterWebhookEvent } from "@octokit/webhooks"

import { MongoService } from "@/infrastructure/mongo/mongodb.service"
import { NormalizeService } from "@/modules/normalize/normalize.service"

import { GithubActiveRepositoriesService } from "../../repositories/github-active-repositories.service"
import { mapWebhookRepository } from "../../repositories/github-repository-tracking.mapper"

import { BaseWebhookRawEventHandler } from "./base-webhook-raw-event.handler"

@Injectable()
export class PullRequestReviewGithubWebhookHandler extends BaseWebhookRawEventHandler {
	private readonly logger = new Logger(
		PullRequestReviewGithubWebhookHandler.name
	)

	public constructor(
		mongoService: MongoService,
		normalizeService: NormalizeService,
		activeRepositoriesService: GithubActiveRepositoriesService
	) {
		super(mongoService, normalizeService, activeRepositoriesService)
	}

	public async handle(
		deliveryId: string,
		payload: EmitterWebhookEvent<"pull_request_review">["payload"]
	) {
		const { action, repository, sender, pull_request, review } = payload

		if (!sender) {
			throw new BadRequestException("No sender provided")
		}

		if (!repository.owner) {
			throw new BadRequestException("No repository owner provided")
		}

		if (!pull_request) {
			throw new BadRequestException("No pull request provided")
		}

		if (!review) {
			throw new BadRequestException("No review provided")
		}

		if (action !== "submitted")
			throw new BadRequestException(
				`Unhandled pull_request_review action: ${action}`
			)

		await this.saveAndNormalizeRawEvent(
			deliveryId,
			repository.full_name,
			"review",
			payload,
			{
				repository: mapWebhookRepository(repository),
				webhookEvent: `pull_request_review.${action}`
			}
		)

		this.logger.log(`Successfully processed pull_request_reviewed`)
	}
}
