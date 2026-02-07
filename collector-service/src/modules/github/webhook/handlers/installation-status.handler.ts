import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { EmitterWebhookEvent } from "@octokit/webhooks"

import { AllConfigs } from "@/config"
import { ActiveRepositoryStatus } from "@/infrastructure/mongo/schemas"

import { GithubActiveRepositoriesService } from "../../repositories/github-active-repositories.service"
import {
	mapInstallationAccount,
	mapInstallationRepository
} from "../../repositories/github-repository-tracking.mapper"

@Injectable()
export class InstallationStatusGithubWebhookHandler {
	private readonly logger = new Logger(InstallationStatusGithubWebhookHandler.name)

	public constructor(
		private readonly configService: ConfigService<AllConfigs>,
		private readonly activeRepositoriesService: GithubActiveRepositoriesService
	) {}

	public async handle(payload: EmitterWebhookEvent<"installation">["payload"]) {
		const { action, installation, repositories } = payload
		const status = this.resolveStatus(action)

		if (!status) return

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
		const eventName = `installation.${action}`

		if (!repositories?.length) {
			await this.activeRepositoriesService.markOwnerRepositoriesStatus(
				repositoryOwner.login,
				status,
				eventName,
				action === "unsuspend" ? ["suspended"] : undefined
			)
			return
		}

		for (const repo of repositories) {
			await this.activeRepositoriesService.markRepositoryStatus(
				mapInstallationRepository(repo, repositoryOwner),
				status,
				eventName
			)
		}

		this.logger.log(
			`Marked ${repositories.length} repository(ies) as ${status} from ${eventName}.`
		)
	}

	private resolveStatus(action: string): ActiveRepositoryStatus | null {
		switch (action) {
			case "deleted":
				return "removed"
			case "suspend":
				return "suspended"
			case "unsuspend":
				return "active"
			default:
				return null
		}
	}
}
