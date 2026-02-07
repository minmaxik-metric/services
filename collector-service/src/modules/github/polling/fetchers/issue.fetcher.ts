import { Injectable, Logger } from "@nestjs/common"

import { MongoService } from "@/infrastructure/mongo/mongodb.service"
import type { PollingStateDocument } from "@/infrastructure/mongo/schemas"
import { NormalizeService } from "@/modules/normalize/normalize.service"

import { GetIssuesResult, GithubApiService } from "../../api/github-api.service"

import { BasePollingFetcher } from "./base-polling.fetcher"

@Injectable()
export class IssueFetcher extends BasePollingFetcher {
	private readonly fetcherLogger = new Logger(IssueFetcher.name)

	public constructor(
		private readonly githubApiService: GithubApiService,
		mongoService: MongoService,
		normalizeService: NormalizeService
	) {
		super(mongoService, normalizeService, new Logger(IssueFetcher.name))
	}

	public async fetch(
		owner: string,
		repo: string,
		pollingState: PollingStateDocument
	): Promise<{
		issues: GetIssuesResult["issues"]
		count: number
		latestNumber: number | null
		latestUpdatedAt: Date | null
	}> {
		const since = pollingState.state.last_issue_updated_at
			? new Date(pollingState.state.last_issue_updated_at.getTime() + 1)
			: null

		let latestNumber = pollingState.state.last_issue_number
		let latestUpdatedAt = pollingState.state.last_issue_updated_at

		let fetchedIssues = 0

		try {
			const {
				repository,
				owner: repositoryOwner,
				issues
			} = await this.githubApiService.getIssues(owner, repo)

			if (!issues?.length) {
				this.fetcherLogger.debug(`No issues for ${owner}/${repo}`)
				return {
					issues: [],
					count: 0,
					latestNumber,
					latestUpdatedAt
				}
			}

			for (const issue of issues) {
				if (!issue?.number || !issue?.createdAt) continue

				const issueUpdatedAt = new Date(issue.updatedAt ?? issue.createdAt)

				if (since && issueUpdatedAt <= since) continue

				const inserted = await this.saveAndNormalizeRawEvent(
					issue.id,
					`${owner}/${repo}`,
					"issue",
					{ repository, owner: repositoryOwner, issue }
				)

				if (inserted) {
					fetchedIssues++

					if (
						!latestUpdatedAt ||
						issueUpdatedAt.getTime() > latestUpdatedAt.getTime()
					) {
						latestNumber = issue.number
						latestUpdatedAt = issueUpdatedAt
					}
				}
			}

			this.fetcherLogger.debug(
				`Fetched ${fetchedIssues} issues for ${owner}/${repo} (since: ${
					since ? since.toISOString() : "beginning"
				})`
			)

			return {
				issues,
				count: fetchedIssues,
				latestNumber,
				latestUpdatedAt
			}
		} catch (error) {
			this.fetcherLogger.error(
				`Failed to fetch issues for ${owner}/${repo}`,
				error
			)

			return {
				issues: [],
				count: 0,
				latestNumber,
				latestUpdatedAt
			}
		}
	}
}
