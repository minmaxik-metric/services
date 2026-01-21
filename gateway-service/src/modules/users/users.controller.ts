import { Role } from "@citec-spbu/contracts/gen/ts/account"
import { Controller, Get, HttpCode, HttpStatus } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation } from "@nestjs/swagger"

import { Protected } from "@/shared/decorators"
import { CurrentUser } from "@/shared/decorators/current-user.decorator"

import { AccountClientGrpc } from "../account/account.grpc"

import { UsersClientGrpc } from "./users.grpc"

@Controller("users")
export class UsersController {
	public constructor(
		private readonly client: UsersClientGrpc,
		private readonly accountClient: AccountClientGrpc
	) {}

	@ApiOperation({
		summary: "Get current user profile.",
		description: "Returns authenticated user profile data"
	})
	@ApiBearerAuth()
	@Protected()
	@Get("@me")
	@HttpCode(HttpStatus.OK)
	public async getMe(@CurrentUser() userId: string) {
		const [{ user }, account] = await Promise.all([
			this.client.call("getMe", {
				id: userId
			}),
			this.accountClient.call("getAccount", {
				id: userId
			})
		])

		return {
			...user,
			role: this.roleName(account.role)
		}
	}

	private roleName(role: Role | string | number | undefined) {
		if (typeof role === "string") {
			if (role.startsWith("ROLE_")) return role

			const numericRole = Number(role)
			if (Number.isFinite(numericRole)) {
				return Role[numericRole] ?? "ROLE_UNSPECIFIED"
			}

			return `ROLE_${role}`
		}

		if (typeof role === "number") return Role[role] ?? "ROLE_UNSPECIFIED"

		return "ROLE_UNSPECIFIED"
	}
}
