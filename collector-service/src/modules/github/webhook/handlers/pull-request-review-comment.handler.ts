import { BadRequestException, Injectable, Logger } from "@nestjs/common"
import { EmitterWebhookEvent } from "@octokit/webhooks"

import { MongoService } from "@/infrastructure/mongo/mongodb.service"
import { NormalizeService } from "@/modules/normalize/normalize.service"

import { GithubActiveRepositoriesService } from "../../repositories/github-active-repositories.service"
import { mapWebhookRepository } from "../../repositories/github-repository-tracking.mapper"

import { BaseWebhookRawEventHandler } from "./base-webhook-raw-event.handler"

@Injectable()
export class PullRequestReviewCommentGithubWebhookHandler extends BaseWebhookRawEventHandler {
	private readonly logger = new Logger(
		PullRequestReviewCommentGithubWebhookHandler.name
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
		payload: EmitterWebhookEvent<"pull_request_review_comment">["payload"]
	) {
		const { action, repository, sender, pull_request, comment } = payload

		if (!sender) {
			throw new BadRequestException("No sender provided")
		}

		if (!repository.owner) {
			throw new BadRequestException("No repository owner provided")
		}

		if (!pull_request) {
			throw new BadRequestException("No pull request provided")
		}

		if (!comment) {
			throw new BadRequestException("No comment provided")
		}

		if (action !== "created") {
			this.logger.debug(
				`Unhandled pull_request_review_comment action: ${action}`
			)
			return
		}

		await this.saveAndNormalizeRawEvent(
			deliveryId,
			repository.full_name,
			"review_comment",
			payload,
			{
				repository: mapWebhookRepository(repository),
				webhookEvent: `pull_request_review_comment.${action}`
			}
		)

		this.logger.log(
			`Successfully processed pull_request_review_comment.${action}`
		)
	}
}
