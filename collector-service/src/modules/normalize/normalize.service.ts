import { NormalizedEventPublished } from "@citec-spbu/contracts"
import { Injectable, Logger } from "@nestjs/common"

import { MessagingService } from "@/infrastructure/messaging/messaging.service"
import { EventType, RawEventDocument } from "@/infrastructure/mongo/schemas"
import { NormalizedEventDocument } from "@/infrastructure/mongo/schemas/normalized-events.schema"

import {
	CommitNormalizer,
	EventNormalizer,
	IssueCommentNormalizer,
	IssueNormalizer,
	IssueTimelineNormalizer,
	PullRequestNormalizer,
	PullRequestReviewCommentNormalizer,
	PullRequestReviewNormalizer,
	PullRequestTimelineNormalizer
} from "./normalizers"

@Injectable()
export class NormalizeService {
	private readonly logger = new Logger(NormalizeService.name)

	public constructor(
		private readonly messagingService: MessagingService,
		private readonly commitNormalizer: CommitNormalizer,
		private readonly issueNormalizer: IssueNormalizer,
		private readonly issueCommentNormalizer: IssueCommentNormalizer,
		private readonly issueTimelineNormalizer: IssueTimelineNormalizer,
		private readonly pullRequestNormalizer: PullRequestNormalizer,
		private readonly pullRequestTimelineNormalizer: PullRequestTimelineNormalizer,
		private readonly pullRequestReviewNormalizer: PullRequestReviewNormalizer,
		private readonly pullRequestReviewCommentNormalizer: PullRequestReviewCommentNormalizer
	) {}

	public async createAndPublishEvent(event: RawEventDocument) {
		const normalizedEvent = await this.normalize(event)
		if (!normalizedEvent) {
			await event.markNormalized()
			this.logger.debug(
				`Skipped normalization for event: ${event.source}/${event.source_id} (${event.event_type})`
			)
			return
		}

		await event.markNormalized()
		await this.publish(normalizedEvent)
	}

	private get normalizers(): Record<EventType, EventNormalizer> {
		return {
			commit: this.commitNormalizer,
			issue: this.issueNormalizer,
			issue_timeline: this.issueTimelineNormalizer,
			comment: this.issueCommentNormalizer,
			pullRequest: this.pullRequestNormalizer,
			pullRequest_timeline: this.pullRequestTimelineNormalizer,
			review: this.pullRequestReviewNormalizer,
			review_comment: this.pullRequestReviewCommentNormalizer
		} as const
	}

	public async normalize(event: RawEventDocument) {
		const normalizer = this.normalizers[event.event_type]

		if (!normalizer) {
			throw new Error(`Unsupported event_type: ${event.event_type}`)
		}

		try {
			const normalizedEvent = await normalizer.normalize(event)
			return normalizedEvent
		} catch (error) {
			throw new Error(`Failed to normalize event ${event.id}`, {
				cause: error
			})
		}
	}

	public async publish(event: NormalizedEventDocument) {
		try {
			const message = {
				id: event._id.toString(),
				source: event.source,
				type: event.event_type,
				publishedAt: new Date(),
				payload: event.payload,
				repositoryOwner: event.repositoryOwner,
				repository: event.repository
			}

			this.messagingService.publishNormalizedEvent(
				message as unknown as NormalizedEventPublished
			)

			await event.markPublished()

			this.logger.log(
				`Published event: ${event.event_key} (${event.event_type})`
			)
		} catch (error) {
			this.logger.error(`Failed to publish event ${event.event_key}: ${error}`)
			throw error
		}
	}
}
