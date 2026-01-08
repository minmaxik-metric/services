import { RpcStatus } from "@citec-spbu/common"
import {
	CreateUserRequest,
	CreateUserResponse,
	GetMeRequest,
	GetMeResponse
} from "@citec-spbu/contracts/gen/ts/users"
import { Injectable } from "@nestjs/common"
import { RpcException } from "@nestjs/microservices"

import { UsersRepository } from "./users.repository"

@Injectable()
export class UsersService {
	public constructor(private readonly usersRepository: UsersRepository) {}

	public async getMe(data: GetMeRequest): Promise<GetMeResponse> {
		const user = await this.usersRepository.findById(data.id)

		if (!user)
			throw new RpcException({
				code: RpcStatus.NOT_FOUND,
				details: "User not found"
			})

		return {
			user: {
				id: user.id,
				username: user.username,
				avatarUrl: user.avatarURL,
				profileUrl: user.profileURL
			}
		}
	}

	public async create(data: CreateUserRequest): Promise<CreateUserResponse> {
		const user = data.user

		if (!user)
			throw new RpcException({ code: RpcStatus.DATA_LOSS, details: "" })

		await this.usersRepository.create({
			id: user.id,
			username: user.username,
			avatarURL: user.avatarUrl,
			profileURL: user.profileUrl
		})

		return {
			ok: true
		}
	}
}
