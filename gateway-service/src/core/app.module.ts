import { JwtModule } from "@citec-spbu/jwt"
import { Module } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"

import { AnalyticsModule } from "@/modules/analytics/analytics.module"
import { AuthModule } from "@/modules/auth/auth.module"
import { UsersModule } from "@/modules/users/users.module"
import { ObservabilityModule } from "@/observability/observability.module"

import { AppController } from "./app.controller"
import { AppService } from "./app.service"
import { getJwtConfig } from "./config"

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: [
				`.env.${process.env.NODE_ENV}.local`,
				`.env.${process.env.NODE_ENV}`,
				`.env`
			]
		}),
		JwtModule.registerAsync({
			useFactory: getJwtConfig,
			inject: [ConfigService]
		}),
		ObservabilityModule,
		AnalyticsModule,
		AuthModule,
		UsersModule
	],
	controllers: [AppController],
	providers: [AppService]
})
export class AppModule {}
