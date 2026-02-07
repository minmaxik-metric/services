import { BadRequestException, Injectable, Logger } from "@nestjs/common"
import { EmitterWebhookEvent } from "@octokit/webhooks"

import { MongoService } from "@/infrastructure/mongo/mongodb.service"
import { NormalizeService } from "@/modules/normalize/normalize.service"

import { GithubActiveRepositoriesService } from "../../repositories/github-active-repositories.service"
import { mapWebhookRepository } from "../../repositories/github-repository-tracking.mapper"

import { BaseWebhookRawEventHandler } from "./base-webhook-raw-event.handler"

@Injectable()
export class IssueGithubWebhookHandler extends BaseWebhookRawEventHandler {
	private readonly logger = new Logger(IssueGithubWebhookHandler.name)

	public constructor(
		mongoService: MongoService,
		normalizeService: NormalizeService,
		activeRepositoriesService: GithubActiveRepositoriesService
	) {
		super(mongoService, normalizeService, activeRepositoriesService)
	}

	public async handle(
		deliveryId: string,
		payload: EmitterWebhookEvent<"issues">["payload"]
	) {
		const { action, repository, sender, issue } = payload

		if (!sender) {
			throw new BadRequestException("No sender provided")
		}

		if (!repository.owner) {
			throw new BadRequestException("No repository owner provided")
		}

		if (!issue) {
			throw new BadRequestException("No issue provided")
		}

		let eventType: "issue" | "issue_timeline"

		switch (action) {
			case "opened":
			case "deleted": {
				eventType = "issue"
				break
			}
			case "closed":
			case "reopened":
			case "assigned":
			case "unassigned":
			case "labeled":
			case "unlabeled":
			case "typed":
			case "untyped": {
				eventType = "issue_timeline"
				break
			}
			default:
				this.logger.debug(`Unhandled issue action: ${action}`)
				return
		}

		await this.saveAndNormalizeRawEvent(
			deliveryId,
			repository.full_name,
			eventType,
			payload,
			{
				repository: mapWebhookRepository(repository),
				webhookEvent: `issues.${action}`
			}
		)

		this.logger.log(`Successfully processed issue.${action}`)
	}
}
