import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { EmitterWebhookEvent } from "@octokit/webhooks"

import { AllConfigs } from "@/config"
import { ActiveRepositoryStatus } from "@/infrastructure/mongo/schemas"

import { GithubActiveRepositoriesService } from "../../repositories/github-active-repositories.service"
import {
	GithubWebhookRepository,
	mapWebhookRepository
} from "../../repositories/github-repository-tracking.mapper"

@Injectable()
export class RepositoryGithubWebhookHandler {
	private readonly logger = new Logger(RepositoryGithubWebhookHandler.name)

	public constructor(
		private readonly configService: ConfigService<AllConfigs>,
		private readonly activeRepositoriesService: GithubActiveRepositoriesService
	) {}

	public async handle(payload: EmitterWebhookEvent<"repository">["payload"]) {
		const { action, repository, organization } = payload
		const allowedOrganizations = this.configService.get("github.allowedOrgs", {
			infer: true
		})
		const organizationUrl = (
			organization as { html_url?: string } | undefined
		)?.html_url
		const ownerUrl = repository.owner?.html_url
		const candidateOrganizationUrls = [organizationUrl, ownerUrl].filter(
			(url): url is string => Boolean(url)
		)

		if (
			allowedOrganizations?.length &&
			candidateOrganizationUrls.length &&
			!candidateOrganizationUrls.some(url => allowedOrganizations.includes(url))
		) {
			return
		}

		const trackedRepository = mapWebhookRepository(repository)
		const status = this.resolveStatus(
			action,
			repository,
			allowedOrganizations ?? []
		)
		const eventName = `repository.${action}`

		await this.activeRepositoriesService.markRepositoryStatus(
			trackedRepository,
			status,
			eventName
		)

		this.logger.log(
			`Marked ${trackedRepository.fullName} as ${status} from ${eventName}.`
		)
	}

	private resolveStatus(
		action: string,
		repository: GithubWebhookRepository,
		allowedOrganizations: string[]
	): ActiveRepositoryStatus {
		switch (action) {
			case "archived":
				return "archived"
			case "deleted":
				return "deleted"
			case "transferred": {
				if (
					repository.owner?.html_url &&
					allowedOrganizations.length &&
					!allowedOrganizations.includes(repository.owner.html_url)
				) {
					return "removed"
				}

				return this.resolveRepositoryAvailability(repository)
			}
			default:
				return this.resolveRepositoryAvailability(repository)
		}
	}

	private resolveRepositoryAvailability(
		repository: GithubWebhookRepository
	): ActiveRepositoryStatus {
		if (repository.disabled) return "disabled"
		if (repository.archived) return "archived"
		return "active"
	}
}
