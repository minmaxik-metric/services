import { create } from "zustand"

export type Semester = "autumn" | "spring"

export type RatingsFilters = {
	organizationId: string
	semester: Semester
	year: number
	dateFrom: string
	dateTo: string
}

type RatingsFilterState = RatingsFilters & {
	setFilters: (filters: Partial<RatingsFilters>) => void
}

export const useRatingsFilterStore = create<RatingsFilterState>((set) => ({
	organizationId: "",
	...currentSemester(),
	dateFrom: "",
	dateTo: "",
	setFilters: (filters) => set(filters)
}))

function currentSemester(): Pick<RatingsFilters, "semester" | "year"> {
	const now = new Date()
	const month = now.getUTCMonth()
	const year = now.getUTCFullYear()

	if (month >= 1 && month <= 7) return { semester: "spring", year }

	return { semester: "autumn", year: month >= 8 ? year : year - 1 }
}
