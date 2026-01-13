import { RpcStatus } from "@citec-spbu/common"
import { Role as ContractRole } from "@citec-spbu/contracts/gen/ts/account"
import {
	Provider as ContractProvider,
	GithubLoginRequest,
	GithubLoginResponse,
	RefreshRequest,
	RefreshResponse,
	ValidateJwtRequest,
	ValidateJwtResponse
} from "@citec-spbu/contracts/gen/ts/auth"
import { JwtService, TokenPayload } from "@citec-spbu/jwt"
import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { RpcException } from "@nestjs/microservices"
import {
	type Account,
	Provider as PrismaProvider,
	Role as PrismaRole
} from "@prisma/generated/client"
import { type StringValue } from "ms"
import { PinoLogger } from "nestjs-pino"

import type { AllConfigs } from "@/config"
import { mapContractToPrisma } from "@/shared/utils"

import { UsersClientGrpc } from "../users/users.grpc"

import { AuthRepository } from "./auth.repository"

@Injectable()
export class AuthService {
	private readonly ACCESS_TOKEN_TTL: StringValue
	private readonly REFRESH_TOKEN_TTL: StringValue

	public constructor(
		private readonly logger: PinoLogger,
		private readonly configService: ConfigService<AllConfigs>,
		private readonly authRepository: AuthRepository,
		private readonly jwtService: JwtService,
		private readonly usersClient: UsersClientGrpc
	) {
		this.ACCESS_TOKEN_TTL = this.configService.get("jwt.accessTokenTTL", {
			infer: true
		})!
		this.REFRESH_TOKEN_TTL = this.configService.get("jwt.refreshTokenTTL", {
			infer: true
		})!
	}

	public async githubLogin(
		data: GithubLoginRequest
	): Promise<GithubLoginResponse> {
		let account: Account | null = null

		const prismaProvider = mapContractToPrisma(
			data.provider,
			ContractProvider,
			PrismaProvider
		)

		account = await this.authRepository.findByProviderId({
			provider: prismaProvider,
			providerId: data.providerId
		})

		const requestedRole = data.role
			? mapContractToPrisma(data.role, ContractRole, PrismaRole)
			: null

		if (!account) {
			account = await this.authRepository.create({
				provider: prismaProvider,
				providerId: data.providerId,
				providerLogin: data.username,
				profileUrl: data.profileUrl,
				role: requestedRole ?? "USER"
			})

			await this.usersClient.call("createUser", {
				user: {
					id: account.id,
					username: data.username,
					avatarUrl: data.avatarUrl,
					profileUrl: data.profileUrl
				}
			})
		} else {
			account = await this.authRepository.updateGithubIdentity(account.id, {
				providerLogin: data.username,
				profileUrl: data.profileUrl
			})

			if (
				requestedRole &&
				this.roleRank(requestedRole) > this.roleRank(account.role)
			) {
				account = await this.authRepository.updateRole(account.id, requestedRole)
			}
		}

		return { tokens: await this.generateTokens(account.id) }
	}

	public async validateJwt(
		data: ValidateJwtRequest
	): Promise<ValidateJwtResponse> {
		const { accessToken } = data

		try {
			const payload = await this.jwtService.verifyAsync(accessToken)
			return { valid: true, accountId: payload.sub }
		} catch {
			return { valid: false }
		}
	}

	public async refresh(data: RefreshRequest): Promise<RefreshResponse> {
		const { refreshToken } = data

		try {
			const payload = await this.jwtService.verifyAsync(refreshToken)

			const accessToken = await this.jwtService.signAsync(
				{ sub: payload.sub },
				{
					expiresIn: this.ACCESS_TOKEN_TTL
				}
			)

			return {
				tokens: { accessToken, refreshToken }
			}
		} catch {
			throw new RpcException({
				code: RpcStatus.UNAUTHENTICATED,
				details: "Refresh token is expired."
			})
		}
	}

	private async generateTokens(userId: string) {
		const payload: TokenPayload = { sub: userId }

		const accessToken = await this.jwtService.signAsync(payload, {
			expiresIn: this.ACCESS_TOKEN_TTL
		})

		const refreshToken = await this.jwtService.signAsync(payload, {
			expiresIn: this.REFRESH_TOKEN_TTL
		})

		return {
			accessToken,
			refreshToken
		}
	}

	private roleRank(role: PrismaRole) {
		if (role === PrismaRole.ADMIN) return 3
		if (role === PrismaRole.SUPERVISOR) return 2

		return 1
	}
}
