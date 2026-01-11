import { IsInt, IsString } from "class-validator"

export class GrpcValidator {
	@IsString()
	public GRPC_HOST: string

	@IsInt()
	public GRPC_PORT: number

	@IsString()
	public USERS_GRPC_URL: string
}
