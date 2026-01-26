import { GrpcModule } from "@citec-spbu/contracts"
import { Module } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

import { AllConfigs } from "@/config"

import { AuthClientGrpc } from "./auth.grpc"

@Module({
	imports: [
		GrpcModule.registerAsync({
			clients: ["AUTH_PACKAGE"],
			useFactory: (configService: ConfigService<AllConfigs>) => ({
				AUTH_PACKAGE: configService.get("grpc.clients.auth", { infer: true })
			}),
			inject: [ConfigService]
		})
	],
	providers: [AuthClientGrpc],
	exports: [AuthClientGrpc]
})
export class AuthModule {}
