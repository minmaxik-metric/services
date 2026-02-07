import { Injectable, Logger } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"

import { MongoService } from "@/infrastructure/mongo/mongodb.service"
import { PollingStateDocument } from "@/infrastructure/mongo/schemas"

import {
	CommitFetcher,
	IssueFetcher,
	IssueTimelineFetcher,
	PullRequestFetcher,
	PullRequestReviewFetcher,
	PullRequestTimelineFetcher
} from "./fetchers"
import { GithubActiveRepositoriesService } from "../repositories/github-active-repositories.service"

@Injectable()
export class GithubPollingService {
	private readonly logger = new Logger(GithubPollingService.name)

	public constructor(
		private readonly mongoService: MongoService,
		private readonly commitFetcher: CommitFetcher,
		private readonly pullRequestFetcher: PullRequestFetcher,
		private readonly issueFetcher: IssueFetcher,
		private readonly issueTimelineFetcher: IssueTimelineFetcher,
		private readonly pullRequestTimelineFetcher: PullRequestTimelineFetcher,
		private readonly pullRequestReviewFetcher: PullRequestReviewFetcher,
		private readonly activeRepositoriesService: GithubActiveRepositoriesService
	) {}

	@Cron(CronExpression.EVERY_6_HOURS)
	public async handlePolling() {
		this.logger.log("Starting GitHub polling cycle")

		const activeRepos =
			await this.activeRepositoriesService.getActiveRepositories()
		if (!activeRepos.length) {
			this.logger.warn("No active repositories registered for GitHub polling")
			return
		}

		for (const repoConfig of activeRepos) {
			try {
				await this.processRepository(repoConfig.owner, repoConfig.repo)
			} catch (error) {
				this.logger.error(
					`Failed to process repository ${repoConfig.owner}/${repoConfig.repo}: ${error}`
				)
			}
		}

		this.logger.log("GitHub polling cycle completed")
	}

	public async processRepository(owner: string, repo: string) {
		const repositoryKey = `${owner}/${repo}`
		this.logger.log(`Processing repository: ${repositoryKey}`)

		const pollingState = await this.ensurePollingState(repositoryKey)
		await this.markCycleStart(repositoryKey)

		let totalCommits = 0
		let totalPRs = 0
		let totalIssues = 0
		let totalIssueTimelineEvents = 0
		let totalPRTimelineEvents = 0
		let totalPRReviews = 0
		let hasErrors = false

		try {
			const commitsResult = await this.commitFetcher.fetch(
				owner,
				repo,
				pollingState
			)
			totalCommits = commitsResult.count

			const pullRequestsResult = await this.pullRequestFetcher.fetch(
				owner,
				repo,
				pollingState
			)
			totalPRs = pullRequestsResult.count

			const issuesResult = await this.issueFetcher.fetch(
				owner,
				repo,
				pollingState
			)
			totalIssues = issuesResult.count

			const issueTimelineResult = await this.issueTimelineFetcher.fetch(
				owner,
				repo,
				issuesResult.issues
			)
			totalIssueTimelineEvents = issueTimelineResult.count

			const prTimelineResult = await this.pullRequestTimelineFetcher.fetch(
				owner,
				repo,
				pullRequestsResult.pullRequests
			)
			totalPRTimelineEvents = prTimelineResult.count

			const prReviewsResult = await this.pullRequestReviewFetcher.fetch(
				owner,
				repo,
				pullRequestsResult.pullRequests
			)
			totalPRReviews = prReviewsResult.count

			await this.updateStateAfterSuccess(repositoryKey, pollingState, {
				latestCommitSha: commitsResult.latestCommitSha,
				latestCommitDate: commitsResult.latestCommitDate,
				latestPrNumber: pullRequestsResult.latestNumber,
				latestPrUpdatedAt: pullRequestsResult.latestUpdatedAt,
				latestIssueNumber: issuesResult.latestNumber,
				latestIssueUpdatedAt: issuesResult.latestUpdatedAt
			})

			this.logger.log(
				`Successfully processed ${repositoryKey}: ${totalCommits} commits, ${totalPRs} PRs, ${totalIssues} issues, ${totalIssueTimelineEvents} issue timeline events, ${totalPRTimelineEvents} PR timeline events, ${totalPRReviews} PR reviews`
			)
		} catch (error) {
			hasErrors = true
			this.logger.error(`Error processing ${repositoryKey}: ${error}`)

			await this.mongoService.createOrUpdatePollingState(repositoryKey, {
				last_failure_at: new Date(),
				last_error: String(error)
			})
		}

		await this.mongoService.updatePollingStateStats(repositoryKey, {
			total_commits: totalCommits,
			total_prs: totalPRs,
			total_issues: totalIssues,
			failed_cycles: hasErrors ? 1 : 0
		})
	}

	private async ensurePollingState(repositoryKey: string) {
		const existingState = await this.mongoService.getPollingState(repositoryKey)

		if (existingState) return existingState

		const createdState = await this.mongoService.createOrUpdatePollingState(
			repositoryKey,
			{
				repository: repositoryKey,
				state: {
					last_commit_sha: null,
					last_commit_date: null,
					last_commit_fetched_at: null,
					last_pr_number: null,
					last_pr_updated_at: null,
					last_pr_fetched_at: null,
					last_issue_number: null,
					last_issue_updated_at: null,
					last_issue_fetched_at: null
				},
				stats: {
					total_commits: 0,
					total_prs: 0,
					total_issues: 0,
					polling_cycles: 0,
					failed_cycles: 0
				}
			}
		)

		this.logger.log(`Created new polling state for ${repositoryKey}`)
		return createdState
	}

	private async markCycleStart(repositoryKey: string) {
		await this.mongoService.createOrUpdatePollingState(repositoryKey, {
			last_poll_at: new Date(),
			last_error: null,
			last_failure_at: null
		})
	}

	private async updateStateAfterSuccess(
		repositoryKey: string,
		pollingState: PollingStateDocument,
		data: {
			latestCommitSha: string | null
			latestCommitDate: Date | null
			latestPrNumber: number | null
			latestPrUpdatedAt: Date | null
			latestIssueNumber: number | null
			latestIssueUpdatedAt: Date | null
		}
	) {
		await this.mongoService.createOrUpdatePollingState(repositoryKey, {
			state: {
				last_commit_sha:
					data.latestCommitSha ?? pollingState.state.last_commit_sha,
				last_commit_date:
					data.latestCommitDate ?? pollingState.state.last_commit_date,
				last_commit_fetched_at: new Date(),
				last_pr_number:
					data.latestPrNumber ?? pollingState.state.last_pr_number,
				last_pr_updated_at:
					data.latestPrUpdatedAt ?? pollingState.state.last_pr_updated_at,
				last_pr_fetched_at: new Date(),
				last_issue_number:
					data.latestIssueNumber ?? pollingState.state.last_issue_number,
				last_issue_updated_at:
					data.latestIssueUpdatedAt ?? pollingState.state.last_issue_updated_at,
				last_issue_fetched_at: new Date()
			},
			last_success_at: new Date()
		})
	}
}
