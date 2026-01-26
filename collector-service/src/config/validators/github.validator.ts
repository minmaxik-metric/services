import { IsString } from "class-validator"

export class GithubValidator {
	@IsString()
	public GITHUB_WEBHOOK_SECRET: string

	@IsString()
	public GITHUB_TOKEN: string

	@IsString()
	public GITHUB_ALLOWED_ORGS: string
}
