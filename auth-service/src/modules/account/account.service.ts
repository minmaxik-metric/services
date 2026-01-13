import { RpcStatus } from "@citec-spbu/common"
import {
	type AddSupervisorToPoolRequest,
	type AddSupervisorToPoolResponse,
	Role as ContractRole,
	type GetAccountRequest,
	type GetAccountResponse,
	type ListSupervisorOrganizationsRequest,
	type ListSupervisorOrganizationsResponse,
	type RegisterSupervisorOrganizationRequest,
	type RegisterSupervisorOrganizationResponse
} from "@citec-spbu/contracts/gen/ts/account"
import { Injectable } from "@nestjs/common"
import { RpcException } from "@nestjs/microservices"
import {
	Provider as PrismaProvider,
	Role as PrismaRole
} from "@prisma/generated/enums"

import { mapPrismaToContract } from "@/shared/utils"

import { AccountRepository } from "./account.repository"

@Injectable()
export class AccountService {
	public constructor(private readonly accountRepository: AccountRepository) {}

	public async getAccount(
		data: GetAccountRequest
	): Promise<GetAccountResponse> {
		const { id } = data

		const account = await this.accountRepository.findById(id)

		if (!account)
			throw new RpcException({
				code: RpcStatus.NOT_FOUND,
				details: "Account not found"
			})

		return {
			id: account.id,
			role: mapPrismaToContract(account.role, PrismaRole, ContractRole)
		}
	}

	public async registerSupervisorOrganization(
		data: RegisterSupervisorOrganizationRequest
	): Promise<RegisterSupervisorOrganizationResponse> {
		const supervisorProviderId = data.supervisorProviderId?.trim()
		const organizationExternalId = data.organizationExternalId?.trim()
		const organizationLogin = data.organizationLogin?.trim()
		const organizationUrl = data.organizationUrl?.trim()

		if (
			!supervisorProviderId ||
			!organizationExternalId ||
			!organizationLogin ||
			!organizationUrl
		) {
			throw new RpcException({
				code: RpcStatus.INVALID_ARGUMENT,
				details: "Supervisor provider id and organization data are required"
			})
		}

		const supervisor = await this.accountRepository.findByProviderId({
			provider: PrismaProvider.GITHUB,
			providerId: supervisorProviderId
		})

		if (!supervisor) {
			throw new RpcException({
				code: RpcStatus.NOT_FOUND,
				details: "Supervisor account not found"
			})
		}

		await this.accountRepository.upsertSupervisorOrganization({
			supervisorId: supervisor.id,
			provider: PrismaProvider.GITHUB,
			externalId: organizationExternalId,
			login: organizationLogin,
			url: organizationUrl
		})

		return { ok: true }
	}

	public async listSupervisorOrganizations(
		data: ListSupervisorOrganizationsRequest
	): Promise<ListSupervisorOrganizationsResponse> {
		const accountId = data.accountId?.trim()

		if (!accountId) {
			throw new RpcException({
				code: RpcStatus.INVALID_ARGUMENT,
				details: "Account id is required"
			})
		}

		const organizations =
			await this.accountRepository.listSupervisorOrganizations(accountId)

		return {
			organizations: organizations.map(organization => ({
				externalId: organization.externalId,
				login: organization.login,
				url: organization.url
			}))
		}
	}

	public async addSupervisorToPool(
		data: AddSupervisorToPoolRequest
	): Promise<AddSupervisorToPoolResponse> {
		const ownerAccountId = data.ownerAccountId?.trim()
		const supervisorIdentity = data.supervisorAccountId?.trim()

		if (!ownerAccountId || !supervisorIdentity) {
			throw new RpcException({
				code: RpcStatus.INVALID_ARGUMENT,
				details: "Owner id and supervisor GitHub login or URL are required"
			})
		}

		if (ownerAccountId === supervisorIdentity) {
			throw new RpcException({
				code: RpcStatus.INVALID_ARGUMENT,
				details: "Cannot add supervisor to their own pool"
			})
		}

		const [owner, supervisor] = await Promise.all([
			this.accountRepository.findById(ownerAccountId),
			this.accountRepository.findByGithubIdentity(supervisorIdentity)
		])

		if (!owner || !supervisor) {
			throw new RpcException({
				code: RpcStatus.NOT_FOUND,
				details: "Supervisor account not found"
			})
		}

		if (owner.id === supervisor.id) {
			throw new RpcException({
				code: RpcStatus.INVALID_ARGUMENT,
				details: "Cannot add supervisor to their own pool"
			})
		}

		if (
			owner.role !== PrismaRole.SUPERVISOR &&
			owner.role !== PrismaRole.ADMIN
		) {
			throw new RpcException({
				code: RpcStatus.PERMISSION_DENIED,
				details: "Only supervisors can share organization pools"
			})
		}

		if (supervisor.role === PrismaRole.USER) {
			await this.accountRepository.promoteToSupervisor(supervisor.id)
		}

		await this.accountRepository.addSupervisorToPool({
			ownerId: ownerAccountId,
			memberId: supervisor.id
		})

		return { ok: true }
	}
}
