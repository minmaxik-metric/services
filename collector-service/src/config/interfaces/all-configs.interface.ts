import type { DatabaseConfig } from "./database.interface"
import type { GithubConfig } from "./github.interface"
import type { GrpcConfig } from "./grpc.interface"
import type { RabbitMQConfig } from "./rabbitmq.interface"

export interface AllConfigs {
	database: DatabaseConfig
	github: GithubConfig
	rabbitmq: RabbitMQConfig
	grpc: GrpcConfig
}
