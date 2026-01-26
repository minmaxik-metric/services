import { Injectable, Logger } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model } from "mongoose"

import {
	ActiveRepository,
	ActiveRepositoryDocument,
	FailedEvent,
	FailedEventDocument,
	IssuePollingState,
	IssuePollingStateDocument,
	PollingState,
	PollingStateDocument,
	PrPollingState,
	PrPollingStateDocument,
	RawEvent,
	RawEventDocument
} from "./schemas"
import {
	NormalizedEvent,
	NormalizedEventDocument
} from "./schemas/normalized-events.schema"

@Injectable()
export class MongoService {
	private readonly logger = new Logger(MongoService.name)

	public constructor(
		@InjectModel(RawEvent.name)
		private rawEventModel: Model<RawEventDocument>,
		@InjectModel(ActiveRepository.name)
		private activeRepositoryModel: Model<ActiveRepositoryDocument>,
		@InjectModel(FailedEvent.name)
		private failedEventModel: Model<FailedEventDocument>,
		@InjectModel(PollingState.name)
		private pollingStateModel: Model<PollingStateDocument>,
		@InjectModel(IssuePollingState.name)
		private issuePollingStateModel: Model<IssuePollingStateDocument>,
		@InjectModel(PrPollingState.name)
		private prPollingStateModel: Model<PrPollingStateDocument>,
		@InjectModel(NormalizedEvent.name)
		private normalizedEventModel: Model<NormalizedEventDocument>
	) {}

	public get rawEvents(): Model<RawEventDocument> {
		return this.rawEventModel
	}

	public get normalizedEvents(): Model<NormalizedEventDocument> {
		return this.normalizedEventModel
	}

	public get activeRepositories(): Model<ActiveRepositoryDocument> {
		return this.activeRepositoryModel
	}

	public get failedEvents(): Model<FailedEventDocument> {
		return this.failedEventModel
	}

	public get pollingStates(): Model<PollingStateDocument> {
		return this.pollingStateModel
	}

	public get issuePollingStates(): Model<IssuePollingStateDocument> {
		return this.issuePollingStateModel
	}

	public get prPollingStates(): Model<PrPollingStateDocument> {
		return this.prPollingStateModel
	}

	public async upsertNormalizedEvent(eventKey: string, query: NormalizedEvent) {
		return await this.normalizedEvents.findOneAndUpdate(
			{ event_key: eventKey },
			{ $setOnInsert: query },
			{ upsert: true, returnDocument: "after" }
		)
	}

	public async getPollingState(
		repository: string
	): Promise<PollingStateDocument | null> {
		return this.pollingStateModel.findOne({ repository })
	}

	public async createOrUpdatePollingState(
		repository: string,
		data: Partial<PollingState>
	): Promise<PollingStateDocument> {
		const update = {
			...data,
			updated_at: new Date()
		}
		const result = await this.pollingStateModel.findOneAndUpdate(
			{ repository },
			{ $set: update },
			{
				upsert: true,
				returnDocument: "after"
			}
		)
		return result
	}

	public async updatePollingStateStats(
		repository: string,
		statsUpdate: Partial<PollingState["stats"]>
	): Promise<PollingStateDocument | null> {
		const incPayload: Record<string, number> = {
			"stats.polling_cycles": 1
		}

		for (const [key, value] of Object.entries(statsUpdate)) {
			if (typeof value !== "number") continue
			incPayload[`stats.${key}`] = value
		}

		return this.pollingStateModel.findOneAndUpdate(
			{ repository },
			{
				$inc: incPayload,
				$set: {
					updated_at: new Date(),
					last_poll_at: new Date()
				}
			},
			{
				returnDocument: "after"
			}
		)
	}
}
