import type { Role } from "@citec-spbu/contracts/gen/ts/account"
import { SetMetadata } from "@nestjs/common"

export const ROLES_KEY = "required_roles"

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles)
