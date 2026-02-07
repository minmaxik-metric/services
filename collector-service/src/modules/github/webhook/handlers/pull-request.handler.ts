import { BadRequestException, Injectable, Logger } from "@nestjs/common"
import { EmitterWebhookEvent } from "@octokit/webhooks"

import { MongoService } from "@/infrastructure/mongo/mongodb.service"
import { NormalizeService } from "@/modules/normalize/normalize.service"

import { GithubActiveRepositoriesService } from "../../repositories/github-active-repositories.service"
import { mapWebhookRepository } from "../../repositories/github-repository-tracking.mapper"

import { BaseWebhookRawEventHandler } from "./base-webhook-raw-event.handler"

@Injectable()
export class PullRequestGithubWebhookHandler extends BaseWebhookRawEventHandler {
	private readonly logger = new Logger(PullRequestGithubWebhookHandler.name)

	public constructor(
		mongoService: MongoService,
		normalizeService: NormalizeService,
		activeRepositoriesService: GithubActiveRepositoriesService
	) {
		super(mongoService, normalizeService, activeRepositoriesService)
	}

	public async handle(
		deliveryId: string,
		payload: EmitterWebhookEvent<"pull_request">["payload"]
	) {
		const { action, repository, sender, pull_request } = payload

		if (!sender) {
			throw new BadRequestException("No sender provided")
		}

		if (!repository.owner) {
			throw new BadRequestException("No repository owner provided")
		}

		if (!pull_request) {
			throw new BadRequestException("No pull request provided")
		}

		let eventType: "pullRequest" | "pullRequest_timeline"

		switch (action) {
			case "opened": {
				eventType = "pullRequest"
				break
			}
			case "closed":
			case "reopened":
			case "assigned":
			case "unassigned":
			case "labeled":
			case "unlabeled":
			case "review_requested":
			case "review_request_removed": {
				eventType = "pullRequest_timeline"
				break
			}
			default:
				this.logger.debug(`Unhandled pull_request action: ${action}`)
				return
		}

		await this.saveAndNormalizeRawEvent(
			deliveryId,
			repository.full_name,
			eventType,
			payload,
			{
				repository: mapWebhookRepository(repository),
				webhookEvent: `pull_request.${action}`
			}
		)

		this.logger.log(`Successfully processed pullRequest.${action}`)
	}
}
