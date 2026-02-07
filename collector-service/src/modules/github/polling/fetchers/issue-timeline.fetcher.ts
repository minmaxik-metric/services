import { Injectable, Logger } from "@nestjs/common"

import { MongoService } from "@/infrastructure/mongo/mongodb.service"
import type { IssuePollingState } from "@/infrastructure/mongo/schemas"
import { NormalizeService } from "@/modules/normalize/normalize.service"

import { GetIssuesResult, GithubApiService } from "../../api/github-api.service"

import { BasePollingFetcher } from "./base-polling.fetcher"

@Injectable()
export class IssueTimelineFetcher extends BasePollingFetcher {
	private readonly fetcherLogger = new Logger(IssueTimelineFetcher.name)

	public constructor(
		private readonly githubApiService: GithubApiService,
		mongoService: MongoService,
		normalizeService: NormalizeService
	) {
		super(mongoService, normalizeService, new Logger(IssueTimelineFetcher.name))
	}

	public async fetch(
		owner: string,
		repo: string,
		issues: GetIssuesResult["issues"]
	): Promise<{ count: number }> {
		if (!issues?.length) {
			this.fetcherLogger.debug(
				`No issues to fetch timeline for ${owner}/${repo}`
			)
			return { count: 0 }
		}

		let insertedCount = 0

		try {
			for (const issue of issues) {
				if (!issue?.number) continue

				const issueStateQuery: IssuePollingState = {
					repository: `${owner}/${repo}`,
					issue_number: issue.number,
					last_timeline_fetched_at: null
				}

				const issuePollingState =
					await this.mongoService.issuePollingStates.findOneAndUpdate(
						{ repository: `${owner}/${repo}`, issue_number: issue.number },
						{ $setOnInsert: issueStateQuery },
						{ upsert: true, returnDocument: "after" }
					)

				const since = issuePollingState.last_timeline_fetched_at
					? new Date(issuePollingState.last_timeline_fetched_at.getTime() + 1)
					: null

				const {
					repository,
					owner: repositoryOwner,
					timeline
				} = await this.githubApiService.getIssueTimeline(
					owner,
					repo,
					issue.number,
					since?.toISOString() ?? null
				)

				if (!timeline?.length) continue

				for (const item of timeline) {
					const sourceId = (item as { id: string }).id
					const inserted = await this.saveAndNormalizeRawEvent(
						sourceId,
						`${owner}/${repo}`,
						"issue_timeline",
						{ repository, owner: repositoryOwner, issue, item },
						true
					)

					if (inserted) {
						insertedCount++
					}
				}
			}

			this.fetcherLogger.debug(
				`Fetched ${insertedCount} issue timeline events for ${owner}/${repo}`
			)

			return { count: insertedCount }
		} catch (error) {
			this.fetcherLogger.error(
				`Failed to fetch issue timelines for ${owner}/${repo}`,
				error
			)

			return { count: 0 }
		}
	}
}
