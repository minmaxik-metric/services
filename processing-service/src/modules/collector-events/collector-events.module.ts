import { Module } from "@nestjs/common"

import { CollectorEventsController } from "./infrastructure/collector-events.controller"
import { CollectorEventsService } from "./infrastructure/collector-events.service"

@Module({
	controllers: [CollectorEventsController],
	providers: [CollectorEventsService]
})
export class CollectorEventsModule {}
