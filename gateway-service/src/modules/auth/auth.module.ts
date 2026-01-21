import { GrpcModule } from "@citec-spbu/contracts"
import { Module } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { PassportModule } from "@nestjs/passport"

import { GithubStrategy } from "@/shared/strategies"

import { AccountModule } from "../account/account.module"

import { AuthController } from "./auth.controller"
import { AuthClientGrpc } from "./auth.grpc"

@Module({
	imports: [
		GrpcModule.registerAsync({
			clients: ["AUTH_PACKAGE"],
			useFactory: (configService: ConfigService) => ({
				AUTH_PACKAGE: configService.getOrThrow("AUTH_GRPC_URL")
			}),
			inject: [ConfigService]
		}),

		PassportModule,
		AccountModule
	],
	controllers: [AuthController],
	providers: [AuthClientGrpc, GithubStrategy]
})
export class AuthModule {}
