import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument } from "mongoose"

export type IssuePollingStateDocument = HydratedDocument<
	IssuePollingState & {
		created_at: Date
		updated_at: Date
	}
>

@Schema({
	collection: "issue_polling_state",
	timestamps: {
		createdAt: "created_at",
		updatedAt: "updated_at"
	}
})
export class IssuePollingState {
	@Prop({ required: true })
	repository: string

	@Prop({ required: true })
	issue_number: number

	@Prop({ type: Date, required: true, default: null })
	last_timeline_fetched_at: Date | null
}

export const IssuePollingStateSchema =
	SchemaFactory.createForClass(IssuePollingState)

IssuePollingStateSchema.index(
	{ repository: 1, issue_number: 1 },
	{ unique: true }
)
