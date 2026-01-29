import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Octokit } from "@octokit/core"
import { paginateGraphQL } from "@octokit/plugin-paginate-graphql"
import { retry } from "@octokit/plugin-retry"
import { throttling } from "@octokit/plugin-throttling"

import { AllConfigs } from "@/config"

import {
	GetBranchesQuery,
	GetBranchesQueryVariables,
	GetCommitsQuery,
	GetCommitsQueryVariables,
	GetIssuesQuery,
	GetIssuesQueryVariables,
	GetIssuesTimelineQuery,
	GetIssuesTimelineQueryVariables,
	GetPullRequestReviewsQuery,
	GetPullRequestReviewsQueryVariables,
	GetPullRequestsQuery,
	GetPullRequestsQueryVariables,
	GetPullRequestTimelineQuery,
	GetPullRequestTimelineQueryVariables,
	GetRepositoriesQuery,
	GetRepositoriesQueryVariables
} from "./generated/graphql"
import {
	GET_BRANCHES_QUERY,
	GET_COMMITS_QUERY,
	GET_ISSUE_TIMELINE_QUERY,
	GET_ISSUES_QUERY,
	GET_PULL_REQUEST_REVIEWS_QUERY,
	GET_PULL_REQUEST_TIMELINE_QUERY,
	GET_PULL_REQUESTS_QUERY,
	GET_REPOSITORIES_QUERY
} from "./queries"

export type GetCommitsResult = Awaited<
	ReturnType<GithubApiService["getCommits"]>
>
export type GetIssuesResult = Awaited<ReturnType<GithubApiService["getIssues"]>>
export type GetIssueTimelineResult = Awaited<
	ReturnType<GithubApiService["getIssueTimeline"]>
>
export type GetPullRequestsResult = Awaited<
	ReturnType<GithubApiService["getPullRequests"]>
>
export type GetPullRequestTimelineResult = Awaited<
	ReturnType<GithubApiService["getPullRequestTimeline"]>
>
export type GetPullRequestReviewsResult = Awaited<
	ReturnType<GithubApiService["getPullRequestReviews"]>
>

const MyOctokit = Octokit.plugin(paginateGraphQL, retry, throttling)

@Injectable()
export class GithubApiService {
	private readonly logger = new Logger(GithubApiService.name)
	private octokit: InstanceType<typeof MyOctokit>

	public constructor(
		private readonly configService: ConfigService<AllConfigs>
	) {
		const token = this.configService.get("github.token", { infer: true })

		this.octokit = new MyOctokit({
			auth: token,

			throttle: {
				onRateLimit: (retryAfter, options) => {
					this.logger.warn(
						`Rate limit hit for ${options.method} ${options.url}. Retry after ${retryAfter}s`
					)
					return true
				},

				onSecondaryRateLimit: retryAfter => {
					this.logger.warn(
						`Secondary rate limit detected. Waiting ${retryAfter}s`
					)
					return true
				}
			}
		})
	}

	public async getRepositories(owner: string) {
		const reposReponse =
			await this.octokit.graphql.paginate<GetRepositoriesQuery>(
				GET_REPOSITORIES_QUERY,
				{ owner } satisfies GetRepositoriesQueryVariables
			)

		if (!reposReponse.repositoryOwner) {
			throw new Error(`No permissions to fetch ${owner}'s repositories`)
		}

		if (!reposReponse.repositoryOwner.repositories.nodes) {
			throw new Error(`No repositories available for ${owner}`)
		}

		return reposReponse.repositoryOwner.repositories.nodes
	}

	public async getAllBranches(owner: string, repo: string) {
		const branchesResponse =
			await this.octokit.graphql.paginate<GetBranchesQuery>(
				GET_BRANCHES_QUERY,
				{ owner, repo } satisfies GetBranchesQueryVariables
			)
		if (!branchesResponse.repository) {
			throw new Error(
				`No repository with given name provided: ${owner}/${repo}`
			)
		}
		if (!branchesResponse.repository.refs) {
			throw new Error(`No accessible branches for ${owner}/${repo}`)
		}

		if (!branchesResponse.repository.refs.nodes) {
			throw new Error(`No branches available for ${owner}/${repo}`)
		}

		return branchesResponse.repository.refs.nodes
	}

	public async getCommits(
		owner: string,
		repo: string,
		branch: string,
		since: string | null = null
	) {
		const commitsResponse =
			await this.octokit.graphql.paginate<GetCommitsQuery>(GET_COMMITS_QUERY, {
				owner,
				repo,
				branch,
				since
			} satisfies GetCommitsQueryVariables)
		if (!commitsResponse.repository) {
			throw new Error(
				`No repository with given name provided: ${owner}/${repo}/${branch}`
			)
		}
		if (
			!commitsResponse.repository.ref ||
			!commitsResponse.repository.ref.target
		) {
			throw new Error(`No accessible commits for ${owner}/${repo}/${branch}`)
		}
		const target = commitsResponse.repository.ref.target
		switch (target.__typename) {
			case "Commit": {
				if (!target.history.nodes) {
					throw new Error(`No commits available for ${owner}/${repo}/${branch}`)
				}
				return {
					repository: {
						id: commitsResponse.repository.id,
						name: commitsResponse.repository.name,
						url: commitsResponse.repository.url
					},
					owner: commitsResponse.repository.owner,
					commits: target.history.nodes
				}
			}
			default: {
				throw new Error(`Unsupported object type ${target.__typename}`)
			}
		}
	}

	public async getDetailedCommit(owner: string, repo: string, sha: string) {
		const { data } = await this.octokit.request(
			"GET /repos/{owner}/{repo}/commits/{ref}",
			{
				owner,
				repo,
				ref: sha
			}
		)

		return data
	}

	public async getIssues(owner: string, repo: string) {
		const issuesResponse = await this.octokit.graphql.paginate<GetIssuesQuery>(
			GET_ISSUES_QUERY,
			{
				owner,
				repo
			} satisfies GetIssuesQueryVariables
		)
		if (!issuesResponse.repository) {
			throw new Error(
				`No repository with given name provided: ${owner}/${repo}`
			)
		}
		if (!issuesResponse.repository.issues.nodes) {
			throw new Error(`No issues available for ${owner}/${repo}`)
		}
		return {
			repository: {
				id: issuesResponse.repository.id,
				name: issuesResponse.repository.name,
				url: issuesResponse.repository.url
			},
			owner: issuesResponse.repository.owner,
			issues: issuesResponse.repository.issues.nodes
		}
	}

	public async getIssueTimeline(
		owner: string,
		repo: string,
		number: number,
		since: string | null = null
	) {
		const issueTimelineResponse =
			await this.octokit.graphql.paginate<GetIssuesTimelineQuery>(
				GET_ISSUE_TIMELINE_QUERY,
				{ owner, repo, number, since } satisfies GetIssuesTimelineQueryVariables
			)
		if (!issueTimelineResponse.repository) {
			throw new Error(
				`No repository with given name provided: ${owner}/${repo}`
			)
		}
		if (!issueTimelineResponse.repository.issue) {
			throw new Error(`No issue: ${owner}/${repo}/issues/${number}`)
		}
		if (!issueTimelineResponse.repository.issue.timelineItems.nodes) {
			throw new Error(
				`No issue timeline available for ${owner}/${repo}/issues/${number}`
			)
		}
		return {
			repository: {
				id: issueTimelineResponse.repository.id,
				name: issueTimelineResponse.repository.name,
				url: issueTimelineResponse.repository.url
			},
			owner: issueTimelineResponse.repository.owner,
			timeline: issueTimelineResponse.repository.issue.timelineItems.nodes
		}
	}

	public async getPullRequests(owner: string, repo: string) {
		const pullRequestResponse =
			await this.octokit.graphql.paginate<GetPullRequestsQuery>(
				GET_PULL_REQUESTS_QUERY,
				{
					owner,
					repo
				} satisfies GetPullRequestsQueryVariables
			)
		if (!pullRequestResponse.repository) {
			throw new Error(
				`No repository with given name provided: ${owner}/${repo}`
			)
		}
		if (!pullRequestResponse.repository.pullRequests.nodes) {
			throw new Error(`No pull requests available for ${owner}/${repo}`)
		}
		return {
			repository: {
				id: pullRequestResponse.repository.id,
				name: pullRequestResponse.repository.name,
				url: pullRequestResponse.repository.url
			},
			owner: pullRequestResponse.repository.owner,
			pullRequests: pullRequestResponse.repository.pullRequests.nodes
		}
	}

	public async getPullRequestTimeline(
		owner: string,
		repo: string,
		number: number,
		since: string | null = null
	) {
		const pullRequestTimelineResponse =
			await this.octokit.graphql.paginate<GetPullRequestTimelineQuery>(
				GET_PULL_REQUEST_TIMELINE_QUERY,
				{
					owner,
					repo,
					number,
					since
				} satisfies GetPullRequestTimelineQueryVariables
			)
		if (!pullRequestTimelineResponse.repository) {
			throw new Error(
				`No repository with given name provided: ${owner}/${repo}`
			)
		}
		if (!pullRequestTimelineResponse.repository.pullRequest) {
			throw new Error(`No pullRequest: ${owner}/${repo}/issues/${number}`)
		}
		if (
			!pullRequestTimelineResponse.repository.pullRequest.timelineItems.nodes
		) {
			throw new Error(
				`No pull request timeline available for ${owner}/${repo}/issues/${number}`
			)
		}
		return {
			repository: {
				id: pullRequestTimelineResponse.repository.id,
				name: pullRequestTimelineResponse.repository.name,
				url: pullRequestTimelineResponse.repository.url
			},
			owner: pullRequestTimelineResponse.repository.owner,
			timeline:
				pullRequestTimelineResponse.repository.pullRequest.timelineItems.nodes
		}
	}

	public async getPullRequestReviews(
		owner: string,
		repo: string,
		number: number
	) {
		const pullRequestReviewsResponse =
			await this.octokit.graphql.paginate<GetPullRequestReviewsQuery>(
				GET_PULL_REQUEST_REVIEWS_QUERY,
				{
					owner,
					repo,
					number
				} satisfies GetPullRequestReviewsQueryVariables
			)
		if (!pullRequestReviewsResponse.repository) {
			throw new Error(
				`No repository with given name provided: ${owner}/${repo}`
			)
		}
		if (!pullRequestReviewsResponse.repository.pullRequest) {
			throw new Error(`No pullRequest: ${owner}/${repo}/issues/${number}`)
		}
		if (!pullRequestReviewsResponse.repository.pullRequest.reviews) {
			throw new Error(`No reviews: ${owner}/${repo}/issues/${number}`)
		}
		if (!pullRequestReviewsResponse.repository.pullRequest.reviews.nodes) {
			throw new Error(
				`No pull request reviews available for ${owner}/${repo}/issues/${number}`
			)
		}
		return {
			repository: {
				id: pullRequestReviewsResponse.repository.id,
				name: pullRequestReviewsResponse.repository.name,
				url: pullRequestReviewsResponse.repository.url
			},
			owner: pullRequestReviewsResponse.repository.owner,
			reviews: pullRequestReviewsResponse.repository.pullRequest.reviews.nodes
		}
	}

	public async getRateLimits() {
		return this.octokit.graphql(`
			query {
				rateLimit {
					remaining
					limit
				}
			}
		`)
	}

	public async getViewer() {
		const owner = "minmaxik-org"
		const repos = await this.getRepositories(owner)
		if (!repos) return "No repos"
		for (const repo of repos) {
			if (!repo) continue
			const { pullRequests } = await this.getPullRequests(owner, repo.name)
			if (!pullRequests) return "No issues"
			for (const pullRequest of pullRequests) {
				if (!pullRequest) continue
				const timeline = await this.getPullRequestTimeline(
					owner,
					repo.name,
					pullRequest.number
				)
				return timeline
			}
		}
	}
}
