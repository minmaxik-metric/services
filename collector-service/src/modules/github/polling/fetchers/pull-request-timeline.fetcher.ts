import { Injectable, Logger } from "@nestjs/common"

import { MongoService } from "@/infrastructure/mongo/mongodb.service"
import type { PrPollingState } from "@/infrastructure/mongo/schemas"
import { NormalizeService } from "@/modules/normalize/normalize.service"

import {
	GetPullRequestsResult,
	GithubApiService
} from "../../api/github-api.service"

import { BasePollingFetcher } from "./base-polling.fetcher"

@Injectable()
export class PullRequestTimelineFetcher extends BasePollingFetcher {
	private readonly fetcherLogger = new Logger(PullRequestTimelineFetcher.name)

	public constructor(
		private readonly githubApiService: GithubApiService,
		mongoService: MongoService,
		normalizeService: NormalizeService
	) {
		super(
			mongoService,
			normalizeService,
			new Logger(PullRequestTimelineFetcher.name)
		)
	}

	public async fetch(
		owner: string,
		repo: string,
		pullRequests: GetPullRequestsResult["pullRequests"]
	): Promise<{ count: number }> {
		if (!pullRequests?.length) {
			this.fetcherLogger.debug(
				`No issues to fetch timeline for ${owner}/${repo}`
			)
			return { count: 0 }
		}

		let insertedCount = 0

		try {
			for (const pr of pullRequests) {
				if (!pr?.number) continue

				const prStateQuery: PrPollingState = {
					repository: `${owner}/${repo}`,
					pr_number: pr.number,
					last_timeline_fetched_at: null
				}

				const prPollingState =
					await this.mongoService.prPollingStates.findOneAndUpdate(
						{ repository: `${owner}/${repo}`, pr_number: pr.number },
						{ $setOnInsert: prStateQuery },
						{ upsert: true, returnDocument: "after" }
					)

				const since = prPollingState.last_timeline_fetched_at
					? new Date(prPollingState.last_timeline_fetched_at.getTime() + 1)
					: null

				const {
					repository,
					owner: repositoryOwner,
					timeline
				} = await this.githubApiService.getPullRequestTimeline(
					owner,
					repo,
					pr.number,
					since?.toISOString() ?? null
				)

				if (!timeline?.length) continue

				for (const item of timeline) {
					const sourceId = (item as { id: string }).id
					const inserted = await this.saveAndNormalizeRawEvent(
						sourceId,
						`${owner}/${repo}`,
						"pullRequest_timeline",
						{
							repository,
							owner: repositoryOwner,
							pullRequest: pr,
							item
						},
						true
					)

					if (inserted) {
						insertedCount++
					}
				}
			}

			this.fetcherLogger.debug(
				`Fetched ${insertedCount} pr timeline events for ${owner}/${repo}`
			)

			return { count: insertedCount }
		} catch (error) {
			this.fetcherLogger.error(
				`Failed to fetch pr timelines for ${owner}/${repo}`,
				error
			)

			return { count: 0 }
		}
	}
}
