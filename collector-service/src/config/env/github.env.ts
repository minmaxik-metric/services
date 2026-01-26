import { validateEnv } from "@citec-spbu/common"
import { registerAs } from "@nestjs/config"

import { GithubConfig } from "../interfaces"
import { GithubValidator } from "../validators"

export const githubEnv = registerAs<GithubConfig>(
	"github",
	(): GithubConfig => {
		validateEnv(process.env, GithubValidator)

		return {
			webhookSecret: process.env.GITHUB_WEBHOOK_SECRET!,
			token: process.env.GITHUB_TOKEN!,
			allowedOrgs: process.env.GITHUB_ALLOWED_ORGS!.trim().split(",")
		}
	}
)
