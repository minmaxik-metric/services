import { createParamDecorator, ExecutionContext } from "@nestjs/common"
import { Request } from "express"

import { User } from "../interfaces"

export const CurrentUser = createParamDecorator(
	(_: unknown, ctx: ExecutionContext) => {
		const request = ctx.switchToHttp().getRequest<Request>()

		const user = request.user as User

		if (!user) return null

		return user.id
	}
)
