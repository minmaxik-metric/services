import { PROTO_PATHS } from "@citec-spbu/contracts"
import { ANALYTICS_V1_PACKAGE_NAME } from "@citec-spbu/contracts/gen/ts/analytics"
import type { GrpcOptions } from "@nestjs/microservices"

export const grpcPackages = [ANALYTICS_V1_PACKAGE_NAME]

export const grpcProtoPaths = [PROTO_PATHS.ANALYTICS]

export const grpcLoader: NonNullable<GrpcOptions["options"]["loader"]> = {
	keepCase: false,
	longs: String,
	enums: String,
	defaults: true,
	oneofs: true,
	includeDirs: [PROTO_PATHS.ROOT]
}
