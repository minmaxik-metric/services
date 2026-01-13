import { GrpcModule } from "@citec-spbu/contracts"
import { Module } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

import { AllConfigs } from "@/config"

import { UsersClientGrpc } from "./users.grpc"

@Module({
	imports: [
		GrpcModule.registerAsync({
			clients: ["USERS_PACKAGE"],
			useFactory: (configService: ConfigService<AllConfigs>) => ({
				USERS_PACKAGE: configService.get("grpc.clients.users", { infer: true })
			}),
			inject: [ConfigService]
		})
	],
	providers: [UsersClientGrpc],
	exports: [UsersClientGrpc]
})
export class UsersModule {}
