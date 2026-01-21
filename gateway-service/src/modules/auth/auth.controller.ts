import { Provider } from "@citec-spbu/contracts/gen/ts/auth"
import {
	BadRequestException,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Post,
	Req,
	Res,
	UseGuards
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { AuthGuard as PassportAuthGuard } from "@nestjs/passport"
import { ApiOperation } from "@nestjs/swagger"
import type { CookieOptions, Request, Response } from "express"
import { Profile } from "passport-github2"

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/shared/constants"

import { AuthClientGrpc } from "./auth.grpc"

const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000

@Controller("auth")
export class AuthController {
	public constructor(
		private readonly client: AuthClientGrpc,
		private readonly configService: ConfigService
	) {}

	@ApiOperation({
		summary: "Init github OAuth2."
	})
	@Get("github")
	@UseGuards(PassportAuthGuard("github"))
	@HttpCode(HttpStatus.OK)
	public github() {}

	@ApiOperation({
		summary: "Callback for github OAuth2."
	})
	@Get("github/callback")
	@UseGuards(PassportAuthGuard("github"))
	public async githubCallback(
		@Req() req: Request,
		@Res() res: Response
	) {
		const user = req.user as Profile

		const { tokens } = await this.client.call("githubLogin", {
			provider: Provider.PROVIDER_GITHUB,
			providerId: user.id,
			username: user.username as string,
			avatarUrl: user.photos?.[0]?.value as string,
			profileUrl: user.profileUrl
		})

		if (!tokens) {
			throw new BadRequestException("Cannot login via github.")
		}

		const { accessToken, refreshToken } = tokens

		this.setAuthCookies(res, accessToken, refreshToken)

		return res.redirect(HttpStatus.FOUND, this.getFrontendUrl())
	}

	@ApiOperation({
		summary: "Refresh access token",
		description: "Renews access token using refresh token from cookies."
	})
	@Post("refresh")
	@HttpCode(HttpStatus.OK)
	public async refresh(
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response
	) {
		const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string

		const { tokens } = await this.client.call("refresh", { refreshToken })

		if (!tokens) {
			throw new BadRequestException("Cannot refresh tokens.")
		}

		const { accessToken } = tokens

		this.setAuthCookies(res, accessToken, tokens.refreshToken ?? refreshToken)

		return { accessToken }
	}

	@ApiOperation({
		summary: "Logout",
		description: "Clears the refresh token cookie and logs the user out."
	})
	@Post("logout")
	@HttpCode(HttpStatus.OK)
	public logout(@Res({ passthrough: true }) res: Response) {
		this.clearAuthCookies(res)

		return { ok: true }
	}

	private setAuthCookies(
		res: Response,
		accessToken: string,
		refreshToken: string
	) {
		const baseOptions = this.getBaseCookieOptions()

		res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
			...baseOptions,
			httpOnly: true
		})

		res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
			...baseOptions,
			httpOnly: true,
			maxAge: REFRESH_TOKEN_MAX_AGE
		})
	}

	private clearAuthCookies(res: Response) {
		const options: CookieOptions = {
			...this.getBaseCookieOptions(),
			httpOnly: true
		}

		res.clearCookie(ACCESS_TOKEN_COOKIE, options)
		res.clearCookie(REFRESH_TOKEN_COOKIE, options)
		res.cookie(ACCESS_TOKEN_COOKIE, "", {
			...options,
			expires: new Date(0),
			maxAge: 0
		})
		res.cookie(REFRESH_TOKEN_COOKIE, "", {
			...options,
			expires: new Date(0),
			maxAge: 0
		})
	}

	private getBaseCookieOptions(): CookieOptions {
		const domain = this.configService.getOrThrow<string>("COOKIES_DOMAIN")

		return {
			secure:
				this.configService.getOrThrow<string>("NODE_ENV") !== "development",
			domain: domain === "localhost" ? undefined : domain,
			sameSite: "lax",
			path: "/"
		}
	}

	private getFrontendUrl() {
		const configuredUrl = this.configService.get<string>("FRONTEND_URL")

		if (configuredUrl) return configuredUrl

		return this.configService.getOrThrow<string>("HTTP_CORS").split(",")[0]
	}
}
