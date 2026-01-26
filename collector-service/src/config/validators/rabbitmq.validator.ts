import { IsString } from "class-validator"

export class RabbitmqValidator {
	@IsString()
	public RABBITMQ_URI: string

	@IsString()
	public RABBITMQ_QUEUE: string

	@IsString()
	public RABBITMQ_EXCHANGE: string
}
