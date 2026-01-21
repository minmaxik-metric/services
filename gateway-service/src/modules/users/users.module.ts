import { GrpcModule } from "@citec-spbu/contracts"
import { Module } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

import { AccountModule } from "../account/account.module"

import { UsersController } from "./users.controller"
import { UsersClientGrpc } from "./users.grpc"

@Module({
	imports: [
		AccountModule,
		GrpcModule.registerAsync({
			clients: ["USERS_PACKAGE"],
			useFactory: (configService: ConfigService) => ({
				USERS_PACKAGE: configService.getOrThrow("USERS_GRPC_URL")
			}),
			inject: [ConfigService]
		})
	],
	controllers: [UsersController],
	providers: [UsersClientGrpc],
	exports: [UsersClientGrpc]
})
export class UsersModule {}
