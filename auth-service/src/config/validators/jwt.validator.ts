import { IsString } from "class-validator"
import { type StringValue } from "ms"

import { IsDuration } from "@/shared/decorators"

export class JwtValidator {
	@IsString()
	public JWT_PRIVATE_KEY_PATH: string

	@IsString()
	public JWT_PUBLIC_KEY_PATH: string

	@IsDuration()
	public JWT_ACCESS_TOKEN_TTL: StringValue

	@IsDuration()
	public JWT_REFRESH_TOKEN_TTL: StringValue
}
