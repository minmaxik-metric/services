import { JwtModuleOptions } from "@citec-spbu/jwt"
import { ConfigService } from "@nestjs/config"
import { readFileSync } from "fs"

export function getJwtConfig(configService: ConfigService): JwtModuleOptions {
	const publicKeyPath = configService.getOrThrow<string>("JWT_PUBLIC_KEY_PATH")

	if (!publicKeyPath) {
		throw new Error("JWT_PUBLIC_KEY_PATH is not configured")
	}

	return {
		publicKey: readFileSync(publicKeyPath)
	}
}
