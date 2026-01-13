import { Injectable } from "@nestjs/common"
import { Account } from "@prisma/generated/client"
import { Provider } from "@prisma/generated/enums"
import { AccountCreateInput } from "@prisma/generated/models"

import { PrismaService } from "@/infrastructure/prisma/prisma.service"

@Injectable()
export class AuthRepository {
	public constructor(private readonly prismaService: PrismaService) {}

	public async findByProviderId(data: {
		provider: Provider
		providerId: string
	}) {
		return await this.prismaService.account.findUnique({
			where: {
				unique_provider_pair: {
					provider: data.provider,
					providerId: data.providerId
				}
			}
		})
	}

	public async create(data: AccountCreateInput): Promise<Account> {
		return await this.prismaService.account.create({ data })
	}

	public async updateRole(id: string, role: Account["role"]): Promise<Account> {
		return await this.prismaService.account.update({
			where: { id },
			data: { role }
		})
	}

	public async updateGithubIdentity(
		id: string,
		data: { providerLogin: string; profileUrl: string }
	): Promise<Account> {
		return await this.prismaService.account.update({
			where: { id },
			data
		})
	}
}
