import {
	AccountServiceControllerMethods,
	type AddSupervisorToPoolRequest,
	type AddSupervisorToPoolResponse,
	type GetAccountRequest,
	type GetAccountResponse,
	type ListSupervisorOrganizationsRequest,
	type ListSupervisorOrganizationsResponse,
	type RegisterSupervisorOrganizationRequest,
	type RegisterSupervisorOrganizationResponse
} from "@citec-spbu/contracts/gen/ts/account"
import { Controller } from "@nestjs/common"

import { AccountService } from "./account.service"

@Controller()
@AccountServiceControllerMethods()
export class AccountController {
	public constructor(private readonly accountService: AccountService) {}

	public async getAccount(
		data: GetAccountRequest
	): Promise<GetAccountResponse> {
		return await this.accountService.getAccount(data)
	}

	public async registerSupervisorOrganization(
		data: RegisterSupervisorOrganizationRequest
	): Promise<RegisterSupervisorOrganizationResponse> {
		return await this.accountService.registerSupervisorOrganization(data)
	}

	public async listSupervisorOrganizations(
		data: ListSupervisorOrganizationsRequest
	): Promise<ListSupervisorOrganizationsResponse> {
		return await this.accountService.listSupervisorOrganizations(data)
	}

	public async addSupervisorToPool(
		data: AddSupervisorToPoolRequest
	): Promise<AddSupervisorToPoolResponse> {
		return await this.accountService.addSupervisorToPool(data)
	}
}
