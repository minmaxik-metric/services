import { ConfigService } from "@nestjs/config"
import { NestFactory } from "@nestjs/core"
import { NestExpressApplication } from "@nestjs/platform-express"

import { AppModule } from "./app.module"
import { createRmqServer } from "./infrastructure/rmq/rmq.server"

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule, {
		rawBody: true
	})

	const config = app.get(ConfigService)

	createRmqServer(app, config)

	await app.startAllMicroservices()
	await app.init()
}
bootstrap()
