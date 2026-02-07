import { MongoService } from "@/infrastructure/mongo/mongodb.service"
import { EventType, RawEvent } from "@/infrastructure/mongo/schemas"
import { NormalizeService } from "@/modules/normalize/normalize.service"

import {
	GithubActiveRepositoriesService,
	GithubRepositoryTrackingInput
} from "../../repositories/github-active-repositories.service"

export abstract class BaseWebhookRawEventHandler {
	protected constructor(
		protected readonly mongoService: MongoService,
		protected readonly normalizeService: NormalizeService,
		protected readonly activeRepositoriesService: GithubActiveRepositoriesService
	) {}

	protected async saveAndNormalizeRawEvent(
		deliveryId: string,
		repositoryFullName: string,
		eventType: EventType,
		payload: unknown,
		options?: {
			repository?: GithubRepositoryTrackingInput
			webhookEvent?: string
			activityAt?: Date
		}
	): Promise<boolean> {
		if (options?.repository) {
			await this.activeRepositoriesService.touchRepositoryActivity(
				options.repository,
				options.webhookEvent ?? eventType,
				options.activityAt
			)
		}

		const query: RawEvent = {
			source: "github",
			source_id: deliveryId,
			method: "webhook",
			event_type: eventType,
			repository: repositoryFullName,
			payload: payload as Record<string, unknown>
		}

		const event = await this.mongoService.rawEvents.findOneAndUpdate(
			{
				source: "github",
				source_id: deliveryId,
				method: "webhook"
			},
			{
				$setOnInsert: query
			},
			{ upsert: true, returnDocument: "after", includeResultMetadata: true }
		)

		if (!event.lastErrorObject?.upserted || !event.value) {
			return false
		}

		await this.normalizeService.createAndPublishEvent(event.value)
		return true
	}
}
