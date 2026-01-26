import { IsString } from "class-validator"

export class GrpcValidator {
	@IsString()
	public AUTH_GRPC_URL: string
}
