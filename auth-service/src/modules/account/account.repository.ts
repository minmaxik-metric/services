import { Injectable } from "@nestjs/common"
import type { Account, Provider } from "@prisma/generated/client"

import { PrismaService } from "@/infrastructure/prisma/prisma.service"

@Injectable()
export class AccountRepository {
	public constructor(private readonly prismaService: PrismaService) {}

	public async findById(id: string): Promise<Account | null> {
		return await this.prismaService.account.findUnique({
			where: {
				id
			}
		})
	}

	public async findByProviderId(data: {
		provider: Provider
		providerId: string
	}): Promise<Account | null> {
		return await this.prismaService.account.findUnique({
			where: {
				unique_provider_pair: {
					provider: data.provider,
					providerId: data.providerId
				}
			}
		})
	}

	public async findByGithubIdentity(identity: string): Promise<Account | null> {
		const normalized = identity.trim().replace(/\/+$/, "")
		const login = this.githubLogin(normalized)
		const url = login ? `https://github.com/${login}` : normalized

		return await this.prismaService.account.findFirst({
			where: {
				provider: "GITHUB",
				OR: [
					{ id: identity },
					{ providerLogin: { equals: login || normalized, mode: "insensitive" } },
					{ profileUrl: { equals: normalized, mode: "insensitive" } },
					{ profileUrl: { equals: url, mode: "insensitive" } }
				]
			}
		})
	}

	private githubLogin(value: string) {
		try {
			const url = new URL(value)
			if (url.hostname !== "github.com") return null

			return url.pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? null
		} catch {
			return value.toLowerCase()
		}
	}

	public async upsertSupervisorOrganization(data: {
		supervisorId: string
		provider: Provider
		externalId: string
		login: string
		url: string
	}) {
		await this.prismaService.supervisorOrganization.upsert({
			where: {
				unique_supervisor_organization: {
					supervisorId: data.supervisorId,
					provider: data.provider,
					externalId: data.externalId
				}
			},
			create: data,
			update: {
				login: data.login,
				url: data.url
			}
		})
	}

	public async listSupervisorOrganizations(accountId: string) {
		const poolOwners = await this.prismaService.supervisorPoolMember.findMany({
			where: { memberId: accountId },
			select: { ownerId: true }
		})
		const supervisorIds = [
			...new Set([accountId, ...poolOwners.map(pool => pool.ownerId)])
		]
		const organizations =
			await this.prismaService.supervisorOrganization.findMany({
				where: {
					supervisorId: { in: supervisorIds }
				},
				select: {
					externalId: true,
					login: true,
					url: true
				},
				orderBy: {
					login: "asc"
				}
			})
		const unique = new Map<string, (typeof organizations)[number]>()

		for (const organization of organizations) {
			unique.set(
				[
					organization.externalId.toLowerCase(),
					organization.login.toLowerCase(),
					organization.url.toLowerCase()
				].join(":"),
				organization
			)
		}

		return [...unique.values()]
	}

	public async addSupervisorToPool(data: {
		ownerId: string
		memberId: string
	}) {
		await this.prismaService.supervisorPoolMember.upsert({
			where: {
				unique_supervisor_pool_member: {
					ownerId: data.ownerId,
					memberId: data.memberId
				}
			},
			create: data,
			update: {}
		})
	}

	public async promoteToSupervisor(id: string) {
		await this.prismaService.account.update({
			where: { id },
			data: { role: "SUPERVISOR" }
		})
	}
}
