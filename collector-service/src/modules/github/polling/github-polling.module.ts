import { Module } from "@nestjs/common"

import { NormalizeModule } from "@/modules/normalize/normalize.module"

import { GithubApiModule } from "../api/github-api.module"
import { GithubRepositoriesModule } from "../repositories/github-repositories.module"

import {
	CommitFetcher,
	IssueFetcher,
	IssueTimelineFetcher,
	PullRequestFetcher,
	PullRequestReviewFetcher,
	PullRequestTimelineFetcher
} from "./fetchers"
import { GithubPollingController } from "./github-polling.controller"
import { GithubPollingService } from "./github-polling.service"

@Module({
	controllers: [GithubPollingController],
	imports: [GithubApiModule, GithubRepositoriesModule, NormalizeModule],
	providers: [
		GithubPollingService,
		CommitFetcher,
		PullRequestFetcher,
		IssueFetcher,
		IssueTimelineFetcher,
		PullRequestTimelineFetcher,
		PullRequestReviewFetcher
	],
	exports: [GithubPollingService]
})
export class GithubPollingModule {}
