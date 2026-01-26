import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument } from "mongoose"

export type PrPollingStateDocument = HydratedDocument<
	PrPollingState & { created_at: Date; updated_at: Date }
>

@Schema({
	collection: "pr_polling_state",
	timestamps: {
		createdAt: "created_at",
		updatedAt: "updated_at"
	}
})
export class PrPollingState {
	@Prop({ required: true })
	repository: string

	@Prop({ required: true })
	pr_number: number

	@Prop({ type: Date, default: null })
	last_timeline_fetched_at?: Date | null

	@Prop({ type: Date, default: null })
	last_review_fetched_at?: Date | null
}

export const PrPollingStateSchema = SchemaFactory.createForClass(PrPollingState)

PrPollingStateSchema.index({ repository: 1, pr_number: 1 }, { unique: true })
