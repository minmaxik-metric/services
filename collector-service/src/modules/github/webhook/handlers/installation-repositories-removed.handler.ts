import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { EmitterWebhookEvent } from "@octokit/webhooks"

import { AllConfigs } from "@/config"

import { GithubActiveRepositoriesService } from "../../repositories/github-active-repositories.service"
import {
	mapInstallationAccount,
	mapInstallationRepository
} from "../../repositories/github-repository-tracking.mapper"

@Injectable()
export class InstallationRepositoriesRemovedGithubWebhookHandler {
	private readonly logger = new Logger(
		InstallationRepositoriesRemovedGithubWebhookHandler.name
	)

	public constructor(
		private readonly configService: ConfigService<AllConfigs>,
		private readonly activeRepositoriesService: GithubActiveRepositoriesService
	) {}

	public async handle(
		payload: EmitterWebhookEvent<"installation_repositories.removed">["payload"]
	) {
		const { repositories_removed, installation } = payload

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

		if (!repositories_removed?.length) {
			this.logger.warn(
				`No repositories available for installation_repositories.removed on ${repositoryOwner.login}`
			)
			return
		}

		for (const repo of repositories_removed) {
			await this.activeRepositoriesService.markRepositoryStatus(
				mapInstallationRepository(repo, repositoryOwner),
				"removed",
				"installation_repositories.removed"
			)
		}

		this.logger.log(
			`Marked ${repositories_removed.length} repository(ies) as removed.`
		)
	}
}
