import type {
	RatingSubjectType,
	ScoringProfile
} from "@/entities/scoring/model/types"
import { apiRequest } from "@/shared/api/client"

export function listScoringProfiles(subjectType: RatingSubjectType) {
	return apiRequest<{ profiles: ScoringProfile[] }>(
		`/analytics/scoring-profiles?subjectType=${subjectType}&includeArchived=false`
	)
}

export function getDefaultScoringProfile(subjectType: RatingSubjectType) {
	return apiRequest<{ profile: ScoringProfile }>(
		`/analytics/scoring-profiles/default?subjectType=${subjectType}`
	)
}

export function upsertScoringProfile(profile: ScoringProfile) {
	return apiRequest<{ profile: ScoringProfile }>(
		`/analytics/scoring-profiles/${profile.id}`,
		{
			method: "PUT",
			body: profile
		}
	)
}
