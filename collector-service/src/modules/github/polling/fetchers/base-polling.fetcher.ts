import { Logger } from "@nestjs/common"

import { MongoService } from "@/infrastructure/mongo/mongodb.service"
import { EventType, RawEvent } from "@/infrastructure/mongo/schemas"
import { NormalizeService } from "@/modules/normalize/normalize.service"

export abstract class BasePollingFetcher {
	protected constructor(
		protected readonly mongoService: MongoService,
		protected readonly normalizeService: NormalizeService,
		protected readonly logger: Logger
	) {}

	protected async saveAndNormalizeRawEvent(
		sourceId: string,
		repositoryFullName: string,
		eventType: EventType,
		payload: Record<string, unknown>,
		withTouchedUpdate = false
	): Promise<boolean> {
		const query: RawEvent = {
			source: "github",
			source_id: sourceId,
			method: "polling",
			event_type: eventType,
			repository: repositoryFullName,
			payload
		}

		const update = withTouchedUpdate
			? {
					$setOnInsert: query,
					$set: {
						updated_at: new Date()
					}
				}
			: { $setOnInsert: query }

		const event = await this.mongoService.rawEvents.findOneAndUpdate(
			{
				source: "github",
				source_id: sourceId,
				method: "polling"
			},
			update,
			{
				upsert: true,
				returnDocument: "after",
				includeResultMetadata: true
			}
		)

		if (!event.lastErrorObject?.upserted || !event.value) {
			return false
		}

		await this.normalizeService.createAndPublishEvent(event.value)
		return true
	}
}
