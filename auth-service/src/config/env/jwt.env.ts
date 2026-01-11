import { validateEnv } from "@citec-spbu/common"
import { registerAs } from "@nestjs/config"
import { type StringValue } from "ms"

import { JwtConfig } from "../interfaces/jwt.interface"
import { JwtValidator } from "../validators"

export const jwtEnv = registerAs<JwtConfig>("jwt", () => {
	validateEnv(process.env, JwtValidator)

	return {
		privateKeyPath: process.env.JWT_PRIVATE_KEY_PATH!,
		publicKeyPath: process.env.JWT_PUBLIC_KEY_PATH!,
		accessTokenTTL: process.env.JWT_ACCESS_TOKEN_TTL! as StringValue,
		refreshTokenTTL: process.env.JWT_REFRESH_TOKEN_TTL! as StringValue
	}
})
