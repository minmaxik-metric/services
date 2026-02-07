import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Webhooks } from "@octokit/webhooks"

import { AllConfigs } from "@/config"

import { InstallationCreatedGithubWebhookHandler } from "./handlers/installation-created.handler"
import { InstallationRepositoriesAddedGithubWebhookHandler } from "./handlers/installation-repositories-added.handler"
import { InstallationRepositoriesRemovedGithubWebhookHandler } from "./handlers/installation-repositories-removed.handler"
import { InstallationStatusGithubWebhookHandler } from "./handlers/installation-status.handler"
import { IssueCommentGithubWebhookHandler } from "./handlers/issue-comment.handler"
import { IssueGithubWebhookHandler } from "./handlers/issues.handler"
import { PullRequestReviewCommentGithubWebhookHandler } from "./handlers/pull-request-review-comment.handler"
import { PullRequestReviewGithubWebhookHandler } from "./handlers/pull-request-review.handler"
import { PullRequestGithubWebhookHandler } from "./handlers/pull-request.handler"
import { PushGithubWebhookHandler } from "./handlers/push.handler"
import { RepositoryGithubWebhookHandler } from "./handlers/repository.handler"

@Injectable()
export class GithubWebhookService {
	private readonly logger = new Logger(GithubWebhookService.name)
	private readonly webhooks: Webhooks

	public constructor(
		private readonly configService: ConfigService<AllConfigs>,
		private readonly pushHandler: PushGithubWebhookHandler,
		private readonly issueHandler: IssueGithubWebhookHandler,
		private readonly issueCommentHandler: IssueCommentGithubWebhookHandler,
		private readonly pullRequestHandler: PullRequestGithubWebhookHandler,
		private readonly pullRequestReviewHandler: PullRequestReviewGithubWebhookHandler,
		private readonly pullRequestReviewCommentHandler: PullRequestReviewCommentGithubWebhookHandler,
		private readonly installationRepositoriesAddedHandler: InstallationRepositoriesAddedGithubWebhookHandler,
		private readonly installationRepositoriesRemovedHandler: InstallationRepositoriesRemovedGithubWebhookHandler,
		private readonly installationCreatedHandler: InstallationCreatedGithubWebhookHandler,
		private readonly installationStatusHandler: InstallationStatusGithubWebhookHandler,
		private readonly repositoryHandler: RepositoryGithubWebhookHandler
	) {
		this.webhooks = new Webhooks({
			secret: this.configService.get("github.webhookSecret", {
				infer: true
			})!
		})
	}

	onModuleInit() {
		this.bindHandlers()

		this.webhooks.onError(err => {
			this.logger.error("Webhook handler error", err)
		})
	}

	private bindHandlers() {
		this.webhooks.on("push", ({ payload }) => this.pushHandler.handle(payload))
		this.webhooks.on("issues", ({ id, payload }) =>
			this.issueHandler.handle(id, payload)
		)
		this.webhooks.on("issue_comment", ({ id, payload }) =>
			this.issueCommentHandler.handle(id, payload)
		)
		this.webhooks.on("pull_request", ({ id, payload }) =>
			this.pullRequestHandler.handle(id, payload)
		)
		this.webhooks.on("pull_request_review", ({ id, payload }) =>
			this.pullRequestReviewHandler.handle(id, payload)
		)
		this.webhooks.on("pull_request_review_comment", ({ id, payload }) =>
			this.pullRequestReviewCommentHandler.handle(id, payload)
		)
		this.webhooks.on("installation_repositories.added", ({ payload }) =>
			this.installationRepositoriesAddedHandler.handle(payload)
		)
		this.webhooks.on("installation_repositories.removed", ({ payload }) =>
			this.installationRepositoriesRemovedHandler.handle(payload)
		)
		this.webhooks.on("installation.created", ({ payload }) =>
			this.installationCreatedHandler.handle(payload)
		)
		this.webhooks.on(
			["installation.deleted", "installation.suspend", "installation.unsuspend"],
			({ payload }) => this.installationStatusHandler.handle(payload)
		)
		this.webhooks.on("repository", ({ payload }) =>
			this.repositoryHandler.handle(payload)
		)
	}

	public async verifyAndReceive(event: {
		id: string
		name: string
		payload: string
		signature: string
	}): Promise<void> {
		await this.webhooks.verifyAndReceive(event)
	}
}
