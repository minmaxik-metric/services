import { JwtModuleOptions } from "@citec-spbu/jwt"
import { ConfigService } from "@nestjs/config"
import { readFileSync } from "node:fs"

import type { AllConfigs } from "../interfaces"

export function getJwtModuleConfig(
	configService: ConfigService<AllConfigs>
): JwtModuleOptions {
	const privateKeyPath = configService.get("jwt.privateKeyPath", {
		infer: true
	})

	const publicKeyPath = configService.get("jwt.publicKeyPath", {
		infer: true
	})

	if (!privateKeyPath) {
		throw new Error("JWT_PRIVATE_KEY_PATH is not configured")
	}

	if (!publicKeyPath) {
		throw new Error("JWT_PUBLIC_KEY_PATH is not configured")
	}

	return {
		privateKey: readFileSync(privateKeyPath),
		publicKey: readFileSync(publicKeyPath)
	}
}
