import { readFileSync } from "fs"
import { join } from "path"

export const GET_BRANCHES_QUERY = readFileSync(
	join(__dirname, "./getBranches.graphql"),
	"utf8"
)

export const GET_COMMITS_QUERY = readFileSync(
	join(__dirname, "./getCommits.graphql"),
	"utf8"
)
export const GET_ISSUES_QUERY = readFileSync(
	join(__dirname, "./getIssues.graphql"),
	"utf8"
)

export const GET_ISSUE_TIMELINE_QUERY = readFileSync(
	join(__dirname, "./getIssueTimeline.graphql"),
	"utf8"
)
export const GET_PULL_REQUESTS_QUERY = readFileSync(
	join(__dirname, "./getPullRequests.graphql"),
	"utf8"
)
export const GET_PULL_REQUEST_TIMELINE_QUERY = readFileSync(
	join(__dirname, "./getPullRequestTimeline.graphql"),
	"utf8"
)
export const GET_PULL_REQUEST_REVIEWS_QUERY = readFileSync(
	join(__dirname, "./getPullRequestReviews.graphql"),
	"utf8"
)

export const GET_REPOSITORIES_QUERY = readFileSync(
	join(__dirname, "./getRepositories.graphql"),
	"utf8"
)
