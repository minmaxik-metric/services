import { Injectable } from "@nestjs/common"
import { User } from "@prisma/generated/client"
import { UserCreateInput } from "@prisma/generated/models"

import { PrismaService } from "@/infrastructure/prisma/prisma.service"

@Injectable()
export class UsersRepository {
	public constructor(private readonly prismaService: PrismaService) {}

	public async findById(id: string) {
		return await this.prismaService.user.findUnique({
			where: {
				id
			}
		})
	}

	public async create(data: UserCreateInput): Promise<User> {
		return await this.prismaService.user.create({ data })
	}
}
