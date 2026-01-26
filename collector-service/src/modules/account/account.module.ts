import { GrpcModule } from "@citec-spbu/contracts"
import { Module } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

import { AllConfigs } from "@/config"

import { AccountClientGrpc } from "./account.grpc"

@Module({
	imports: [
		GrpcModule.registerAsync({
			clients: ["ACCOUNT_PACKAGE"],
			useFactory: (configService: ConfigService<AllConfigs>) => ({
				ACCOUNT_PACKAGE: configService.get("grpc.clients.auth", { infer: true })
			}),
			inject: [ConfigService]
		})
	],
	providers: [AccountClientGrpc],
	exports: [AccountClientGrpc]
})
export class AccountModule {}
