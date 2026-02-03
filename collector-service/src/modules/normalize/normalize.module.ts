import { Module } from "@nestjs/common"

import { MongoModule } from "@/infrastructure/mongo/mongodb.module"

import { NormalizeService } from "./normalize.service"
import {
	CommitNormalizer,
	IssueCommentNormalizer,
	IssueNormalizer,
	IssueTimelineNormalizer,
	PullRequestNormalizer,
	PullRequestReviewCommentNormalizer,
	PullRequestReviewNormalizer,
	PullRequestTimelineNormalizer
} from "./normalizers"

@Module({
	imports: [MongoModule],
	providers: [
		NormalizeService,
		CommitNormalizer,
		IssueNormalizer,
		IssueCommentNormalizer,
		IssueTimelineNormalizer,
		PullRequestNormalizer,
		PullRequestTimelineNormalizer,
		PullRequestReviewNormalizer,
		PullRequestReviewCommentNormalizer
	],
	exports: [NormalizeService]
})
export class NormalizeModule {}
