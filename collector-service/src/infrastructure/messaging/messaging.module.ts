import { Global, Module } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { ClientProvider, ClientsModule, Transport } from "@nestjs/microservices"

import { AllConfigs } from "@/config"

import { MessagingService } from "./messaging.service"

const processingClientFactory = (
	configService: ConfigService<AllConfigs>
): ClientProvider => ({
	transport: Transport.RMQ,
	options: {
		urls: [configService.get<string>("rabbitmq.uri", { infer: true })!],
		queue: configService.get<string>("rabbitmq.queue", { infer: true }),
		exchange: configService.get<string>("rabbitmq.exchange", { infer: true }),
		queueOptions: {
			durable: true
		}
	}
})

@Global()
@Module({
	imports: [
		ClientsModule.registerAsync({
			clients: [
				{
					name: "PROCESSING_CLIENT",
					useFactory: processingClientFactory,
					inject: [ConfigService]
				}
			]
		})
	],
	providers: [MessagingService],
	exports: [MessagingService]
})
export class MessagingModule {}
