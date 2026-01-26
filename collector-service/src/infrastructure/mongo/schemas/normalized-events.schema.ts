import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument } from "mongoose"

export type NormalizedEventDocument = HydratedDocument<
	NormalizedEvent & {
		created_at: Date
		updated_at: Date
		markPublished(): Promise<NormalizedEventDocument>
	}
>

@Schema({
	collection: "normalized_events",
	timestamps: {
		createdAt: "created_at",
		updatedAt: "updated_at"
	}
})
export class NormalizedEvent {
	@Prop({
		type: String,
		required: true,
		unique: true,
		index: true
	})
	event_key: string

	@Prop({
		type: String,
		required: true,
		index: true
	})
	event_type: string

	@Prop({
		type: String,
		required: true,
		enum: ["github"],
		index: true
	})
	source: "github"

	@Prop({
		type: Object,
		required: true
	})
	repositoryOwner: {
		id: string
		name: string
		url: string
		avatarUrl: string
	}

	@Prop({
		type: Object,
		required: true
	})
	repository: {
		id: string
		name: string
		url: string
	}

	@Prop({
		type: Object,
		required: true
	})
	payload: Record<string, any>

	@Prop({
		type: Boolean,
		default: false
	})
	published?: boolean = false

	@Prop({
		type: Date,
		default: null
	})
	published_at?: Date | null = null
}

export const NormalizedEventSchema =
	SchemaFactory.createForClass(NormalizedEvent)

NormalizedEventSchema.methods.markPublished = async function (
	this: NormalizedEventDocument
) {
	try {
		this.published = true
		this.published_at = new Date()

		return this.save()
	} catch (err) {
		throw new Error(
			`Can't mark event "${this.source}/${this.event_key}" published`,
			{ cause: err }
		)
	}
}
