import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { EmitterWebhookEvent } from "@octokit/webhooks"

import { AllConfigs } from "@/config"

import { GithubPollingService } from "../../polling/github-polling.service"
import { GithubActiveRepositoriesService } from "../../repositories/github-active-repositories.service"
import {
	mapInstallationAccount,
	mapInstallationRepository
} from "../../repositories/github-repository-tracking.mapper"

@Injectable()
export class InstallationRepositoriesAddedGithubWebhookHandler {
	private readonly logger = new Logger(
		InstallationRepositoriesAddedGithubWebhookHandler.name
	)

	public constructor(
		private readonly configService: ConfigService<AllConfigs>,
		private readonly pollingService: GithubPollingService,
		private readonly activeRepositoriesService: GithubActiveRepositoriesService
	) {}

	public async handle(
		payload: EmitterWebhookEvent<"installation_repositories.added">["payload"]
	) {
		const { repositories_added, installation } = payload

		const allowedOrganizations = this.configService.get("github.allowedOrgs", {
			infer: true
		})

		if (
			!installation.account ||
			!allowedOrganizations?.includes(installation.account.html_url)
		) {
			return
		}

		const repositoryOwner = mapInstallationAccount(installation.account)
		const owner = repositoryOwner.login

		if (!repositories_added) {
			this.logger.warn(
				`No repositories available for installation_repositories on ${owner}`
			)
			return
		}

		for (const repo of repositories_added) {
			try {
				await this.activeRepositoriesService.markRepositoryActive(
					mapInstallationRepository(repo, repositoryOwner),
					"installation_repositories.added"
				)
				await this.pollingService.processRepository(owner, repo.name)
			} catch (err) {
				this.logger.warn(
					`Installation polling skipped for ${owner}/${repo.name}: ${err}`
				)
			}
		}

		this.logger.log(
			`Successfully processed ${repositories_added.length} repository(ies).`
		)
	}
}
