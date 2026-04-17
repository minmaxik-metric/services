export type RatingsQueryDto = {
	repositoryId?: string
	organizationId?: string
	semester?: string
	year?: string
	semesterYear?: string
	season?: string
	dateFrom?: string
	dateTo?: string
	limit?: string
	weights?: string
}

export type SemestersQueryDto = Pick<RatingsQueryDto, "organizationId">
