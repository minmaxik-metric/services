import { Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { NestFactory } from "@nestjs/core"

import { AppModule } from "./app.module"

async function bootstrap() {
	const app = await NestFactory.create(AppModule, {
		rawBody: true
	})
	const config = app.get(ConfigService)
	const logger = new Logger()

	const port = config.getOrThrow<number>("HTTP_PORT")
	const host = config.getOrThrow<string>("HTTP_HOST")

	await app.listen(port)

	logger.log(`Collector started: ${host}`)
}

bootstrap()
