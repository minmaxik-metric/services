import { JwtService } from "@citec-spbu/jwt"
import {
	type CanActivate,
	type ExecutionContext,
	Injectable,
	UnauthorizedException
} from "@nestjs/common"
import type { Request } from "express"

import { ACCESS_TOKEN_COOKIE } from "../constants"

@Injectable()
export class AuthGuard implements CanActivate {
	public constructor(private readonly jwtService: JwtService) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<Request>()

		const token = this.extractToken(request)

		try {
			const { sub } = await this.jwtService.verifyAsync(token)

			if (!sub) throw new UnauthorizedException("Token not valid.")

			request.user = {
				id: sub
			}

			return true
		} catch {
			return false
		}
	}

	private extractToken(request: Request) {
		const header = request.headers.authorization

		if (!header) {
			const cookieToken = request.cookies?.[ACCESS_TOKEN_COOKIE] as
				| string
				| undefined

			if (!cookieToken) {
				throw new UnauthorizedException("Authorization token missing")
			}

			return cookieToken
		}

		if (!header.startsWith(`Bearer `))
			throw new UnauthorizedException("Unauthorized")

		const token = header.replace(/^Bearer\s/i, "").trim()

		if (!token) throw new UnauthorizedException("No token provided")

		return token
	}
}
