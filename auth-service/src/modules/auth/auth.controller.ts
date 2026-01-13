import {
	AuthServiceControllerMethods,
	type GithubLoginRequest,
	type GithubLoginResponse,
	type RefreshRequest,
	type RefreshResponse,
	type ValidateJwtRequest,
	type ValidateJwtResponse
} from "@citec-spbu/contracts/gen/ts/auth"
import { Controller } from "@nestjs/common"

import { AuthService } from "./auth.service"

@Controller()
@AuthServiceControllerMethods()
export class AuthController {
	public constructor(private readonly authService: AuthService) {}

	public async githubLogin(
		data: GithubLoginRequest
	): Promise<GithubLoginResponse> {
		return await this.authService.githubLogin(data)
	}

	public async validateJwt(
		data: ValidateJwtRequest
	): Promise<ValidateJwtResponse> {
		return await this.authService.validateJwt(data)
	}

	public async refresh(data: RefreshRequest): Promise<RefreshResponse> {
		return await this.authService.refresh(data)
	}
}
