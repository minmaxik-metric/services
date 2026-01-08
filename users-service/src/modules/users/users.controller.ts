import {
	CreateUserRequest,
	CreateUserResponse,
	GetMeRequest,
	UsersServiceControllerMethods
} from "@citec-spbu/contracts/gen/ts/users"
import { Controller } from "@nestjs/common"

import { UsersService } from "./users.service"

@Controller()
@UsersServiceControllerMethods()
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	public async getMe(data: GetMeRequest) {
		return await this.usersService.getMe(data)
	}

	public async createUser(
		data: CreateUserRequest
	): Promise<CreateUserResponse> {
		return await this.usersService.create(data)
	}
}
