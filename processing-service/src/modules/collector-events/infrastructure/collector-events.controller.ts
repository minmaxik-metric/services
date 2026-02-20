import type { NormalizedEventPublished } from "@citec-spbu/contracts"
import { Controller, Logger } from "@nestjs/common"
import { Ctx, EventPattern, Payload, RmqContext } from "@nestjs/microservices"

import { RmqService } from "@/infrastructure/rmq/rmq.service"

import { CollectorEventsService } from "./collector-events.service"

@Controller()
export class CollectorEventsController {
	private readonly logger = new Logger(CollectorEventsController.name)

	public constructor(
		private readonly collectorEventsService: CollectorEventsService,
		private readonly rmqService: RmqService
	) {}

	@EventPattern("processing.normalized.event")
	public async handleNormalizedEvent(
		@Payload() event: NormalizedEventPublished,
		@Ctx() context: RmqContext
	): Promise<void> {
		try {
			await this.collectorEventsService.ingestNormalizedEvent(event)
			this.rmqService.ack(context)
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			this.logger.error(
				`Failed to process normalized event id=${event?.id} type=${event?.type}: ${message}`
			)
			this.rmqService.nack(context, false)
		}
	}
}
