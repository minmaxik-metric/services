import { Injectable, Logger } from "@nestjs/common"

import { MongoService } from "@/infrastructure/mongo/mongodb.service"
import type { PollingStateDocument } from "@/infrastructure/mongo/schemas"
import { NormalizeService } from "@/modules/normalize/normalize.service"

import {
	GetPullRequestsResult,
	GithubApiService
} from "../../api/github-api.service"

import { BasePollingFetcher } from "./base-polling.fetcher"

@Injectable()
export class PullRequestFetcher extends BasePollingFetcher {
	private readonly fetcherLogger = new Logger(PullRequestFetcher.name)

	public constructor(
		private readonly githubApiService: GithubApiService,
		mongoService: MongoService,
		normalizeService: NormalizeService
	) {
		super(mongoService, normalizeService, new Logger(PullRequestFetcher.name))
	}

	public async fetch(
		owner: string,
		repo: string,
		pollingState: PollingStateDocument
	): Promise<{
		pullRequests: GetPullRequestsResult["pullRequests"]
		count: number
		latestNumber: number | null
		latestUpdatedAt: Date | null
	}> {
		const since = pollingState.state.last_pr_updated_at
			? new Date(pollingState.state.last_pr_updated_at.getTime() + 1)
			: null

		let latestNumber = pollingState.state.last_pr_number
		let latestUpdatedAt = pollingState.state.last_pr_updated_at

		let fetchedPRs = 0

		try {
			const {
				repository,
				owner: repositoryOwner,
				pullRequests
			} = await this.githubApiService.getPullRequests(owner, repo)

			if (!pullRequests?.length) {
				this.fetcherLogger.debug(`No pull requests for ${owner}/${repo}`)
				return {
					pullRequests: [],
					count: 0,
					latestNumber,
					latestUpdatedAt
				}
			}

			for (const pr of pullRequests) {
				if (!pr?.number || !pr?.createdAt) continue

				const prUpdatedAt = new Date(pr.updatedAt ?? pr.createdAt)

				if (since && prUpdatedAt <= since) continue

				const inserted = await this.saveAndNormalizeRawEvent(
					pr.id,
					`${owner}/${repo}`,
					"pullRequest",
					{ repository, owner: repositoryOwner, pullRequest: pr }
				)

				if (inserted) {
					fetchedPRs++

					if (
						!latestUpdatedAt ||
						prUpdatedAt.getTime() > latestUpdatedAt.getTime()
					) {
						latestNumber = pr.number
						latestUpdatedAt = prUpdatedAt
					}
				}
			}

			this.fetcherLogger.debug(
				`Fetched ${fetchedPRs} pull requests for ${owner}/${repo} (since: ${
					since ? since.toISOString() : "beginning"
				})`
			)

			return {
				pullRequests,
				count: fetchedPRs,
				latestNumber,
				latestUpdatedAt
			}
		} catch (error) {
			this.fetcherLogger.error(
				`Failed to fetch pull requests for ${owner}/${repo}`,
				error
			)

			return {
				pullRequests: [],
				count: 0,
				latestNumber,
				latestUpdatedAt
			}
		}
	}
}
