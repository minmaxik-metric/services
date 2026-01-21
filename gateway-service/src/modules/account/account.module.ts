import { GrpcModule } from "@citec-spbu/contracts"
import { Module } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

import { AccountClientGrpc } from "./account.grpc"

@Module({
	imports: [
		GrpcModule.registerAsync({
			clients: ["ACCOUNT_PACKAGE"],
			useFactory: (configService: ConfigService) => ({
				ACCOUNT_PACKAGE: configService.getOrThrow("AUTH_GRPC_URL")
			}),
			inject: [ConfigService]
		})
	],
	providers: [AccountClientGrpc],
	exports: [AccountClientGrpc]
})
export class AccountModule {}
