import type { DatabaseConfig } from "./database.interface"
import type { RabbitMQConfig } from "./rabbitmq.interface"

export interface AllConfigs {
	database: DatabaseConfig
	rabbitmq: RabbitMQConfig
}
