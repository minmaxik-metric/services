import { PROTO_PATHS } from "@citec-spbu/contracts"
import { USERS_V1_PACKAGE_NAME } from "@citec-spbu/contracts/gen/ts/users"
import type { GrpcOptions } from "@nestjs/microservices"

export const grpcPackages = [USERS_V1_PACKAGE_NAME]

export const grpcProtoPaths = [PROTO_PATHS.USERS]

export const grpcLoader: NonNullable<GrpcOptions["options"]["loader"]> = {
	keepCase: false,
	longs: String,
	enums: String,
	defaults: true,
	oneofs: true
}
