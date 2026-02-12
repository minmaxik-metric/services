import { validateEnv } from "@citec-spbu/common"
import { registerAs } from "@nestjs/config"

import { RabbitMQConfig } from "../interfaces"
import { RabbitmqValidator } from "../validators"

export const rabbitmqEnv = registerAs<RabbitMQConfig>("rabbitmq", () => {
	validateEnv(process.env, RabbitmqValidator)

	return {
		uri: process.env.RABBITMQ_URI!,
		queue: process.env.RABBITMQ_QUEUE!,
		exchange: process.env.RABBITMQ_EXCHANGE!
	}
})
