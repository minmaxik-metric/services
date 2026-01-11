import { type StringValue } from "ms"

export interface JwtConfig {
	privateKeyPath: string
	publicKeyPath: string
	accessTokenTTL: StringValue
	refreshTokenTTL: StringValue
}
