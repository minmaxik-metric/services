import { GrpcModule } from "@citec-spbu/contracts"
import { Module } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

import { AccountModule } from "../account/account.module"

import { AnalyticsController } from "./analytics.controller"
import { AnalyticsClientGrpc } from "./analytics.grpc"

@Module({
	imports: [
		AccountModule,
		GrpcModule.registerAsync({
			clients: ["ANALYTICS_PACKAGE"],
			useFactory: (configService: ConfigService) => ({
				ANALYTICS_PACKAGE: configService.getOrThrow("ANALYTICS_GRPC_URL")
			}),
			inject: [ConfigService]
		})
	],
	controllers: [AnalyticsController],
	providers: [AnalyticsClientGrpc]
})
export class AnalyticsModule {}
