import { Injectable, Logger } from "@nestjs/common"
import { type RmqContext } from "@nestjs/microservices"

@Injectable()
export class RmqService {
	private readonly logger = new Logger(RmqService.name)

	public ack(context: RmqContext): void {
		const channel = context.getChannelRef()
		const message = context.getMessage()

		channel.ack(message)
	}

	public nack(context: RmqContext, requeue = false): void {
		const channel = context.getChannelRef()
		const message = context.getMessage()

		channel.nack(message, false, requeue)

		if (requeue) {
			this.logger.warn(
				`NACK with requeue (pattern: ${context.getPattern() as string})`
			)
			return
		}

		this.logger.error(
			`NACK without requeue (pattern: ${context.getPattern() as string})`
		)
	}
}
