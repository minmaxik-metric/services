import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"

import { databaseEnv, rabbitmqEnv } from "./config"
import { PrismaModule } from "./infrastructure/prisma/prisma.module"
import { RmqModule } from "./infrastructure/rmq/rmq.module"
import { CollectorEventsModule } from "./modules/collector-events/collector-events.module"

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: [
				`.env.${process.env.NODE_ENV}.local`,
				`.env.${process.env.NODE_ENV}`,
				`.env`
			],
			load: [databaseEnv, rabbitmqEnv]
		}),
		RmqModule,
		PrismaModule,
		CollectorEventsModule
	]
})
export class AppModule {}
