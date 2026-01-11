import { Module } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { LoggerModule } from "nestjs-pino"

import { databaseEnv, getLoggerModuleConfig, grpcEnv, jwtEnv } from "./config"
import { PrismaModule } from "./infrastructure/prisma/prisma.module"
import { AccountModule } from "./modules/account/account.module"
import { AuthModule } from "./modules/auth/auth.module"
import { UsersModule } from "./modules/users/users.module"
import { ObservabilityModule } from "./observability/observability.module"

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: [
				`.env.${process.env.NODE_ENV}.local`,
				`.env.${process.env.NODE_ENV}`,
				`.env`
			],
			load: [databaseEnv, grpcEnv, jwtEnv]
		}),
		LoggerModule.forRootAsync({
			useFactory: getLoggerModuleConfig,
			inject: [ConfigService]
		}),
		AuthModule,
		PrismaModule,
		ObservabilityModule,
		AccountModule,
		UsersModule
	]
})
export class AppModule {}
