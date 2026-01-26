import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import type { HydratedDocument } from "mongoose"

export type PollingStateDocument = HydratedDocument<
	PollingState & { created_at: Date; updated_at: Date }
>

@Schema({
	collection: "polling_state",
	timestamps: {
		createdAt: "created_at",
		updatedAt: "updated_at"
	}
})
export class PollingState {
	@Prop({
		type: String,
		required: true,
		unique: true
	})
	repository: string

	@Prop({
		type: Object,
		required: true
	})
	state: {
		last_commit_sha: string | null
		last_commit_date: Date | null
		last_commit_fetched_at: Date | null

		last_pr_number: number | null
		last_pr_updated_at: Date | null
		last_pr_fetched_at: Date | null

		last_issue_number: number | null
		last_issue_updated_at: Date | null
		last_issue_fetched_at: Date | null
	}

	@Prop({
		type: Object,
		required: true
	})
	stats: {
		total_commits: number
		total_prs: number
		total_issues: number
		polling_cycles: number
		failed_cycles: number
	}

	@Prop({
		type: Date,
		required: true
	})
	last_poll_at: Date | null

	@Prop({
		type: Date,
		default: null
	})
	last_success_at?: Date | null

	@Prop({
		type: Date,
		default: null
	})
	last_failure_at?: Date | null

	@Prop({
		type: String,
		default: null
	})
	last_error?: string | null
}

export const PollingStateSchema = SchemaFactory.createForClass(PollingState)

PollingStateSchema.index({ last_poll_at: -1 })
