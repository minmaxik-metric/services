import type { DatabaseConfig } from "./database.interface"
import type { GrpcConfig } from "./grpc.interface"
import type { JwtConfig } from "./jwt.interface"

export interface AllConfigs {
	grpc: GrpcConfig
	database: DatabaseConfig
	jwt: JwtConfig
}
