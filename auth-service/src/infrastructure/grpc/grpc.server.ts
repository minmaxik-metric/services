import type { INestApplication } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { MicroserviceOptions, Transport } from "@nestjs/microservices"

import type { AllConfigs } from "@/config"

import { grpcLoader, grpcPackages, grpcProtoPaths } from "./grpc.options"

export function createGrpcServer(
	app: INestApplication,
	config: ConfigService<AllConfigs>
) {
	const host = config.get("grpc.host", { infer: true })
	const port = config.get("grpc.port", { infer: true })

	const url = `${host}:${port}`

	app.connectMicroservice<MicroserviceOptions>(
		{
			transport: Transport.GRPC,
			options: {
				package: grpcPackages,
				protoPath: grpcProtoPaths,
				url,
				loader: grpcLoader
			}
		},
		{ inheritAppConfig: true }
	)
}
