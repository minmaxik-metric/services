import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument } from "mongoose"

export type RawEventDocument = HydratedDocument<
	RawEvent & {
		received_at: Date
		updated_at: Date
		markNormalized(): Promise<RawEventDocument>
	}
>

export const EVENT_TYPES = [
	"commit",
	"issue",
	"issue_timeline",
	"comment",
	"pullRequest",
	"pullRequest_timeline",
	"review",
	"review_comment"
] as const

export type EventType = (typeof EVENT_TYPES)[number]

@Schema({
	collection: "raw-events",
	timestamps: {
		createdAt: "recieved_at",
		updatedAt: "updated_at"
	}
})
export class RawEvent {
	@Prop({
		type: String,
		required: true,
		enum: ["github"],
		index: true
	})
	source: "github"

	@Prop({
		type: String,
		required: true
	})
	source_id: string

	@Prop({
		type: String,
		required: true,
		index: true,
		enum: EVENT_TYPES
	})
	event_type: EventType

	@Prop({
		type: String,
		required: true,
		enum: ["webhook", "polling", "manual"],
		index: true
	})
	method: "webhook" | "polling" | "manual"

	@Prop({
		type: String,
		required: true,
		index: true
	})
	repository: string

	@Prop({
		type: Object,
		required: true
	})
	payload: Record<string, any>

	@Prop({
		type: Boolean,
		default: false
	})
	normalized?: boolean = false

	@Prop({
		type: Date,
		default: null
	})
	normalized_at?: Date | null = null
}

export const RawEventSchema = SchemaFactory.createForClass(RawEvent)

RawEventSchema.index({ source: 1, source_id: 1, method: 1 }, { unique: true })

RawEventSchema.index({ repository: 1, event_type: 1 })

RawEventSchema.index(
	{ fetched_at: 1 },
	{ expireAfterSeconds: 90 * 24 * 60 * 60 }
)

RawEventSchema.methods.markNormalized = async function (
	this: RawEventDocument
) {
	try {
		this.normalized = true
		this.normalized_at = new Date()

		return this.save()
	} catch (err) {
		throw new Error(
			`Can't mark event "${this.source}/${this.source_id}" normalized`,
			{ cause: err }
		)
	}
}
