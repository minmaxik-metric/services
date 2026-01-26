import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import type { HydratedDocument } from "mongoose"

export type FailedEventDocument = HydratedDocument<
	FailedEvent & {
		created_at: Date
		updated_at: Date
	}
>

@Schema({
	collection: "failed_events",
	timestamps: {
		createdAt: "createdAt",
		updatedAt: "updatedAt"
	}
})
export class FailedEvent {
	@Prop({
		type: String,
		required: true,
		unique: true
	})
	event_id: string

	@Prop({
		type: Object,
		required: true
	})
	original_event: any

	@Prop({
		type: String,
		enum: ["pending", "processing", "failed_permanent", "resolved"],
		default: "pending",
		index: true
	})
	status: string

	@Prop({
		type: Object,
		required: true
	})
	error: {
		message: string
		stack?: string
		stage: "validation" | "processing" | "queue" | "storage"
		code?: string
	}

	@Prop({
		type: Number,
		default: 0
	})
	retry_count: number

	@Prop({
		type: Date,
		default: null
	})
	last_retry_at: Date

	@Prop({
		type: Date,
		default: null
	})
	next_retry_at: Date

	@Prop({
		type: Object,
		default: {}
	})
	metadata: {
		source?: string
		repository?: string
		sender?: string
		received_at?: Date
	}

	@Prop({
		type: Date,
		default: Date.now
	})
	created_at: Date

	@Prop({
		type: Date,
		default: Date.now
	})
	updated_at: Date
}

export const FailedEventSchema = SchemaFactory.createForClass(FailedEvent)

FailedEventSchema.index({ status: 1, next_retry_at: 1 })
FailedEventSchema.index(
	{ created_at: 1 },
	{ expireAfterSeconds: 30 * 24 * 60 * 60 }
)
