import type { SupervisorOrganizationOptionResponseDto } from "../dto/responses/supervisor-organization-option.response"

export type RatingScope = {
	accountId: string
	isSupervisor: boolean
	organizationIds: string[]
	organizations: SupervisorOrganizationOptionResponseDto[]
}
