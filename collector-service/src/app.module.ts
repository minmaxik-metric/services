import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { ScheduleModule } from "@nestjs/schedule"

import { MongoModule } from "@/infrastructure/mongo/mongodb.module"
import { GithubModule } from "@/modules/github/github.module"

import { databaseEnv, githubEnv, grpcEnv, rabbitmqEnv } from "./config"
import { MessagingModule } from "./infrastructure/messaging/messaging.module"

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: [
				`.env.${process.env.NODE_ENV}.local`,
				`.env.${process.env.NODE_ENV}`,
				`.env`
			],
			load: [databaseEnv, githubEnv, rabbitmqEnv, grpcEnv]
		}),
		MongoModule,
		ScheduleModule.forRoot(),
		GithubModule,
		MessagingModule
	]
})
export class AppModule {}
