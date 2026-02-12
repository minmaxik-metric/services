import type { INestApplication } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { type MicroserviceOptions, Transport } from "@nestjs/microservices"

import type { AllConfigs } from "@/config"

export function createRmqServer(
	app: INestApplication,
	config: ConfigService<AllConfigs>
) {
	app.connectMicroservice<MicroserviceOptions>(
		{
			transport: Transport.RMQ,
			options: {
				urls: [config.getOrThrow<string>("rabbitmq.uri", { infer: true })],
				queue: config.getOrThrow<string>("rabbitmq.queue", { infer: true }),
				queueOptions: {
					durable: true
				},
				noAck: false,
				persistent: true,
				prefetchCount: 1
			}
		},
		{ inheritAppConfig: true }
	)
}
