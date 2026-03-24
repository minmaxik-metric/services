import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"

import { databaseEnv, grpcEnv } from "./config"
import { PrismaModule } from "./infrastructure/prisma/prisma.module"
import { RatingsModule } from "./modules/ratings/ratings.module"

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: [
				`.env.${process.env.NODE_ENV}.local`,
				`.env.${process.env.NODE_ENV}`,
				`.env`
			],
			load: [databaseEnv, grpcEnv]
		}),
		PrismaModule,
		RatingsModule
	]
})
export class AppModule {}
