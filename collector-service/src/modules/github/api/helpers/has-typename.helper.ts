export function hasTypename<
	T extends { __typename?: string } | null | undefined,
	Names extends NonNullable<T>["__typename"][]
>(
	value: T,
	typenames: Names
): value is Extract<NonNullable<T>, { __typename: Names[number] }> {
	return typenames.includes(value?.__typename)
}
