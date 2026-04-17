export type Semester = "autumn" | "spring"

export type SemesterRange = {
	semester: Semester
	year: number
	label: string
	from: Date
	toExclusive: Date
}
