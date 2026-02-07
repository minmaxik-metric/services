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
export class PullRequestReviewFetcher extends BasePollingFetcher {
	private readonly fetcherLogger = new Logger(PullRequestReviewFetcher.name)

	public constructor(
		private readonly githubApiService: GithubApiService,
		mongoService: MongoService,
		normalizeService: NormalizeService
	) {
		super(
			mongoService,
			normalizeService,
			new Logger(PullRequestReviewFetcher.name)
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
		let insertedComments = 0

		try {
			for (const pr of pullRequests) {
				if (!pr?.number) continue

				const prStateQuery: PrPollingState = {
					repository: `${owner}/${repo}`,
					pr_number: pr.number,
					last_review_fetched_at: null
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
					reviews
				} = await this.githubApiService.getPullRequestReviews(
					owner,
					repo,
					pr.number
				)

				if (!reviews?.length) continue

				for (const review of reviews) {
					if (!review?.id) continue

					const reviewCreatedAt = new Date(review.createdAt)
					if (since && reviewCreatedAt <= since) continue

					if (review.comments.nodes) {
						for (const comment of review.comments.nodes) {
							if (!comment?.id) continue

							const commentCreatedAt = new Date(comment.createdAt)
							if (since && commentCreatedAt <= since) continue

							const inserted = await this.saveAndNormalizeRawEvent(
								comment.id,
								`${owner}/${repo}`,
								"review_comment",
								{
									repository,
									owner: repositoryOwner,
									review,
									comment
								}
							)

							if (inserted) {
								insertedComments++
							}
						}
					}

					const inserted = await this.saveAndNormalizeRawEvent(
						review.id,
						`${owner}/${repo}`,
						"review",
						{
							repository,
							owner: repositoryOwner,
							pullRequest: pr,
							review
						}
					)

					if (inserted) {
						insertedCount++
					}
				}
			}

			this.fetcherLogger.debug(
				`Fetched ${insertedCount} PR reviews and ${insertedComments} review comments for ${owner}/${repo}`
			)

			return { count: insertedCount }
		} catch (error) {
			this.fetcherLogger.error(
				`Failed to fetch PR reviews for ${owner}/${repo}`,
				error
			)

			return { count: 0 }
		}
	}
}
