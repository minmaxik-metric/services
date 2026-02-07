import { Module } from "@nestjs/common"

import { AccountModule } from "@/modules/account/account.module"
import { AuthModule } from "@/modules/auth/auth.module"
import { NormalizeModule } from "@/modules/normalize/normalize.module"

import { GithubApiModule } from "../api/github-api.module"
import { GithubPollingModule } from "../polling/github-polling.module"
import { GithubRepositoriesModule } from "../repositories/github-repositories.module"

import { GithubWebhookController } from "./github-webhook.controller"
import { GithubWebhookService } from "./github-webhook.service"
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

@Module({
	controllers: [GithubWebhookController],
	imports: [
		GithubPollingModule,
		AuthModule,
		AccountModule,
		GithubApiModule,
		GithubRepositoriesModule,
		NormalizeModule
	],
	providers: [
		GithubWebhookService,
		PushGithubWebhookHandler,
		IssueGithubWebhookHandler,
		IssueCommentGithubWebhookHandler,
		PullRequestGithubWebhookHandler,
		PullRequestReviewGithubWebhookHandler,
		PullRequestReviewCommentGithubWebhookHandler,
		InstallationCreatedGithubWebhookHandler,
		InstallationStatusGithubWebhookHandler,
		InstallationRepositoriesAddedGithubWebhookHandler,
		InstallationRepositoriesRemovedGithubWebhookHandler,
		RepositoryGithubWebhookHandler
	]
})
export class GithubWebhookModule {}
