import { Injectable, Logger } from "@nestjs/common"

import { MongoService } from "@/infrastructure/mongo/mongodb.service"
import type { PollingStateDocument } from "@/infrastructure/mongo/schemas"
import { NormalizeService } from "@/modules/normalize/normalize.service"

import { GithubApiService } from "../../api/github-api.service"

import { BasePollingFetcher } from "./base-polling.fetcher"

@Injectable()
export class CommitFetcher extends BasePollingFetcher {
	private readonly fetcherLogger = new Logger(CommitFetcher.name)

	public constructor(
		private readonly githubApiService: GithubApiService,
		mongoService: MongoService,
		normalizeService: NormalizeService
	) {
		super(mongoService, normalizeService, new Logger(CommitFetcher.name))
	}

	public async fetch(
		owner: string,
		repo: string,
		pollingState: PollingStateDocument
	): Promise<{
		count: number
		latestCommitSha: string | null
		latestCommitDate: Date | null
	}> {
		const since = pollingState.state.last_commit_date
			? new Date(pollingState.state.last_commit_date.getTime() + 1)
			: null

		let latestCommitSha = pollingState.state.last_commit_sha
		let latestCommitDate = pollingState.state.last_commit_date

		let fetchedCommits = 0

		try {
			const branches = await this.githubApiService.getAllBranches(owner, repo)

			if (!branches?.length) {
				this.fetcherLogger.debug(`No branches for ${owner}/${repo}`)
				return {
					count: 0,
					latestCommitSha,
					latestCommitDate
				}
			}

			for (const branch of branches) {
				if (!branch?.name) continue

				const {
					repository,
					owner: repositoryOwner,
					commits
				} = await this.githubApiService.getCommits(
					owner,
					repo,
					branch.name,
					since?.toISOString() ?? null
				)

				if (!commits?.length) continue

				for (const commit of commits) {
					if (!commit?.oid || !commit?.committedDate || !commit?.author?.user)
						continue

					const commitDate = new Date(commit.committedDate)

					const inserted = await this.saveAndNormalizeRawEvent(
						commit.oid,
						`${owner}/${repo}`,
						"commit",
						{ repository, owner: repositoryOwner, commit }
					)

					if (inserted) {
						fetchedCommits++

						if (
							!latestCommitDate ||
							commitDate.getTime() > latestCommitDate.getTime()
						) {
							latestCommitSha = commit.oid
							latestCommitDate = commitDate
						}
					}
				}
			}

			this.fetcherLogger.debug(
				`Fetched ${fetchedCommits} commits for ${owner}/${repo} (since: ${
					since ? since.toISOString() : "beginning"
				})`
			)

			return {
				count: fetchedCommits,
				latestCommitSha,
				latestCommitDate
			}
		} catch (error) {
			this.fetcherLogger.error(
				`Failed to fetch commits for ${owner}/${repo}`,
				error
			)

			return {
				count: 0,
				latestCommitSha,

				latestCommitDate
			}
		}
	}
}
