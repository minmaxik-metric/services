import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import type { HydratedDocument } from "mongoose"

export const ACTIVE_REPOSITORY_STATUSES = [
	"active",
	"archived",
	"deleted",
	"removed",
	"disabled",
	"suspended"
] as const

export type ActiveRepositoryStatus =
	(typeof ACTIVE_REPOSITORY_STATUSES)[number]

export type ActiveRepositoryDocument = HydratedDocument<
	ActiveRepository & { created_at: Date; updated_at: Date }
>

@Schema({
	collection: "active_repositories",
	timestamps: {
		createdAt: "created_at",
		updatedAt: "updated_at"
	}
})
export class ActiveRepository {
	@Prop({
		type: Number,
		required: true,
		unique: true,
		index: true
	})
	repository_id: number

	@Prop({
		type: String,
		required: true,
		index: true
	})
	node_id: string

	@Prop({
		type: String,
		required: true,
		index: true
	})
	full_name: string

	@Prop({
		type: String,
		required: true,
		index: true
	})
	owner: string

	@Prop({
		type: String,
		required: true
	})
	name: string

	@Prop({
		type: String,
		required: true
	})
	url: string

	@Prop({
		type: String,
		default: null
	})
	api_url?: string | null

	@Prop({
		type: Boolean,
		required: true,
		default: false
	})
	is_private: boolean

	@Prop({
		type: Boolean,
		required: true,
		default: false
	})
	archived: boolean

	@Prop({
		type: Boolean,
		required: true,
		default: false
	})
	disabled: boolean

	@Prop({
		type: String,
		default: null
	})
	default_branch?: string | null

	@Prop({
		type: String,
		required: true,
		enum: ACTIVE_REPOSITORY_STATUSES,
		index: true,
		default: "active"
	})
	status: ActiveRepositoryStatus

	@Prop({
		type: Date,
		default: null
	})
	status_changed_at?: Date | null

	@Prop({
		type: String,
		default: null
	})
	status_reason?: string | null

	@Prop({
		type: Date,
		default: null,
		index: true
	})
	last_activity_at?: Date | null

	@Prop({
		type: Date,
		default: null
	})
	last_webhook_at?: Date | null

	@Prop({
		type: String,
		default: null
	})
	last_webhook_event?: string | null

	@Prop({
		type: Object,
		required: true
	})
	owner_info: {
		id: string | null
		node_id: string | null
		login: string
		url: string | null
		avatar_url: string | null
	}
}

export const ActiveRepositorySchema =
	SchemaFactory.createForClass(ActiveRepository)

ActiveRepositorySchema.index({ status: 1, full_name: 1 })
ActiveRepositorySchema.index({ owner: 1, status: 1 })
