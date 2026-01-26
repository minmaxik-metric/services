import { Global, Module } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { MongooseModule } from "@nestjs/mongoose"

import { AllConfigs } from "@/config"

import { MongoService } from "./mongodb.service"
import {
	ActiveRepository,
	ActiveRepositorySchema,
	FailedEvent,
	FailedEventSchema,
	IssuePollingState,
	IssuePollingStateSchema,
	PollingState,
	PollingStateSchema,
	PrPollingState,
	PrPollingStateSchema,
	RawEvent,
	RawEventSchema
} from "./schemas"
import {
	NormalizedEvent,
	NormalizedEventSchema
} from "./schemas/normalized-events.schema"

@Global()
@Module({
	imports: [
		MongooseModule.forRootAsync({
			useFactory: (configService: ConfigService<AllConfigs>) => ({
				uri: configService.get("database.uri", { infer: true })
			}),
			inject: [ConfigService]
		}),
		MongooseModule.forFeature([
			{
				name: RawEvent.name,
				schema: RawEventSchema
			},
			{
				name: ActiveRepository.name,
				schema: ActiveRepositorySchema
			},
			{
				name: FailedEvent.name,
				schema: FailedEventSchema
			},
			{
				name: PollingState.name,
				schema: PollingStateSchema
			},
			{
				name: IssuePollingState.name,
				schema: IssuePollingStateSchema
			},
			{
				name: PrPollingState.name,
				schema: PrPollingStateSchema
			},
			{
				name: NormalizedEvent.name,
				schema: NormalizedEventSchema
			}
		])
	],
	providers: [MongoService],
	exports: [MongoService]
})
export class MongoModule {}
