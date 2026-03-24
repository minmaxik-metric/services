import type { DatabaseConfig } from "./database.interface"
import type { GrpcConfig } from "./grpc.interface"

export interface AllConfigs {
	grpc: GrpcConfig
	database: DatabaseConfig
}
