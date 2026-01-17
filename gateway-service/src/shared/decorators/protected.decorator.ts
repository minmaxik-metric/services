import type { Role } from "@citec-spbu/contracts/gen/ts/account"
import { applyDecorators, UseGuards } from "@nestjs/common"

import { AuthGuard, RolesGuard } from "../guards"

import { Roles } from "./roles.decorator"

export const Protected = (...roles: Role[]) => {
	if (roles.length === 0) return applyDecorators(UseGuards(AuthGuard))

	return applyDecorators(Roles(...roles), UseGuards(AuthGuard, RolesGuard))
}
