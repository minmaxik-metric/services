import { MongoService } from "@/infrastructure/mongo/mongodb.service"
import { NormalizedEvent } from "@/infrastructure/mongo/schemas/normalized-events.schema"

export abstract class BaseNormalizer {
	protected constructor(protected readonly mongoService: MongoService) {}

	protected async upsert(eventKey: string, query: NormalizedEvent) {
		return await this.mongoService.upsertNormalizedEvent(eventKey, query)
	}

	protected buildWebhookRepository(repository: {
		node_id: string
		name: string
		url: string
	}) {
		return {
			id: repository.node_id,
			name: repository.name,
			url: repository.url
		}
	}

	protected buildWebhookRepositoryOwner(repository: {
		owner: {
			node_id: string
			login: string
			url: string
			avatar_url: string
		}
	}) {
		return {
			id: repository.owner.node_id,
			name: repository.owner.login,
			url: repository.owner.url,
			avatarUrl: repository.owner.avatar_url
		}
	}
}
