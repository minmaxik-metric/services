import { Role } from "@citec-spbu/contracts/gen/ts/account"
import { Provider } from "@citec-spbu/contracts/gen/ts/auth"
import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { EmitterWebhookEvent } from "@octokit/webhooks"

import { AllConfigs } from "@/config"
import { AccountClientGrpc } from "@/modules/account/account.grpc"
import { AuthClientGrpc } from "@/modules/auth/auth.grpc"

import { GithubPollingService } from "../../polling/github-polling.service"
import { GithubActiveRepositoriesService } from "../../repositories/github-active-repositories.service"
import {
	mapInstallationAccount,
	mapInstallationRepository
} from "../../repositories/github-repository-tracking.mapper"

@Injectable()
export class InstallationCreatedGithubWebhookHandler {
	private readonly logger = new Logger(
		InstallationCreatedGithubWebhookHandler.name
	)

	public constructor(
		private readonly configService: ConfigService<AllConfigs>,
		private readonly authService: AuthClientGrpc,
		private readonly accountService: AccountClientGrpc,
		private readonly pollingService: GithubPollingService,
		private readonly activeRepositoriesService: GithubActiveRepositoriesService
	) {}

	public async handle(payload: EmitterWebhookEvent<"installation">["payload"]) {
		const { action, installation, repositories, sender } = payload

		const allowedOrganizations = this.configService.get("github.allowedOrgs", {
			infer: true
		})

		if (
			!installation.account ||
			!allowedOrganizations?.includes(installation.account.html_url)
		) {
			return
		}

		if (action !== "created") return

		await this.authService.call("githubLogin", {
			username: sender.login,
			provider: Provider.PROVIDER_GITHUB,
			providerId: String(sender.id),
			profileUrl: sender.html_url,
			avatarUrl: sender.avatar_url,
			role: Role.ROLE_SUPERVISOR
		})

		const organization = installation.account as {
			id?: number | string
			node_id?: string
			login: string
			html_url: string
		}
		const owner = organization.login

		if (organization.id) {
			await this.accountService.call("registerSupervisorOrganization", {
				supervisorProviderId: String(sender.id),
				organizationExternalId: String(
					organization.node_id ?? organization.login ?? organization.id
				),
				organizationLogin: organization.login,
				organizationUrl: organization.html_url
			})
		}

		if (!repositories) {
			this.logger.warn(`No repositories available for installation on ${owner}`)
			return
		}

		const repositoryOwner = mapInstallationAccount(organization)

		for (const repo of repositories) {
			try {
				await this.activeRepositoriesService.markRepositoryActive(
					mapInstallationRepository(repo, repositoryOwner),
					"installation.created"
				)
				await this.pollingService.processRepository(owner, repo.name)
			} catch (err) {
				this.logger.warn(
					`Installation polling skipped for ${owner}/${repo.name}: ${err}`
				)
			}
		}

		this.logger.log(
			`Successfully processed ${repositories.length} repository(ies).`
		)
	}
}
