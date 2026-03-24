import { validateEnv } from "@citec-spbu/common"
import { registerAs } from "@nestjs/config"

import { GrpcConfig } from "../interfaces/grpc.interface"
import { GrpcValidator } from "../validators"

export const grpcEnv = registerAs<GrpcConfig>("grpc", () => {
	validateEnv(process.env, GrpcValidator)

	return {
		host: process.env.GRPC_HOST!,
		port: parseInt(process.env.GRPC_PORT!)
	}
})
