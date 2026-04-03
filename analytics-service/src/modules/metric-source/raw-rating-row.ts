export interface RawRatingRow {
	bucket: Date
	organizationId: string
	repositoryId: string
	subjectId: string
	subjectLabel: string
	metadata: Record<string, string>
	values: Record<string, number>
}
