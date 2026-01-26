import { NormalizedEventPublished } from "@citec-spbu/contracts"
import { Inject, Injectable } from "@nestjs/common"
import { ClientProxy } from "@nestjs/microservices"

@Injectable()
export class MessagingService {
	public constructor(
		@Inject("PROCESSING_CLIENT") private readonly client: ClientProxy
	) {}

	public publishNormalizedEvent(data: NormalizedEventPublished) {
		return this.client.emit("processing.normalized.event", data)
	}
}
