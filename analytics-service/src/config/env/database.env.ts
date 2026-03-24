import { validateEnv } from "@citec-spbu/common"
import { registerAs } from "@nestjs/config"

import { DatabaseConfig } from "../interfaces/database.interface"
import { DatabaseValidator } from "../validators"

export const databaseEnv = registerAs<DatabaseConfig>("database", () => {
	validateEnv(process.env, DatabaseValidator)

	return {
		uri: process.env.DATABASE_URI!
	}
})
