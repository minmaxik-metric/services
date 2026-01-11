/**
 * Maps a Prisma database enum value to its corresponding gRPC enum value.
 *
 * Supports case-insensitive matching and handles both exact matches and prefixed keys
 * (e.g., `PROVIDER_GITHUB` → `GITHUB`). This reverses the transformation performed by
 * {@link mapContractToPrisma}.
 *
 * @template TPrismaEnum - The Prisma enum type (Record<string, string>)
 * @template TContractEnum - The Contract/Protocol Buffer enum type (Record<string, string | number>)
 *
 * @param prismaValue - The value from Prisma enum to map (e.g., "GITHUB")
 * @param prismaEnum - The Prisma enum object containing all possible values
 * @param contractEnum - The Contract enum object to search for matches
 *
 * @returns The matching Contract enum value
 *
 * @throws {Error} When no matching Contract enum key is found, includes available keys in message
 *
 * @example
 * ```typescript
 * // Prisma: enum Provider { GITHUB = 'GITHUB', GOOGLE = 'GOOGLE' }
 * // Contract: enum AuthProvider { PROVIDER_UNSPECIFIED = 0, PROVIDER_GITHUB = 1, PROVIDER_GOOGLE = 2 }
 *
 * const result = mapPrismaToContract(
 *   'GITHUB',
 *   PrismaProvider,
 *   AuthProvider
 * ); // Returns: AuthProvider.PROVIDER_GITHUB (1)
 * ```
 */
export function mapPrismaToContract<
	TPrismaEnum extends Record<string, string>,
	TContractEnum extends Record<string, string | number>
>(
	prismaValue: TPrismaEnum[keyof TPrismaEnum],
	prismaEnum: TPrismaEnum,
	contractEnum: TContractEnum
): TContractEnum[keyof TContractEnum] {
	const prismaValueStr = String(prismaValue).toUpperCase()

	const contractKey = Object.keys(contractEnum).find(
		key =>
			key.toUpperCase().endsWith(`_${prismaValueStr}`) ||
			key.toUpperCase() === prismaValueStr
	)

	if (!contractKey) {
		throw new Error(
			`No matching contract enum value found for Prisma value: ${prismaValue}.\nAvailable contract keys: ${Object.keys(contractEnum).join(", ")}`
		)
	}

	return contractEnum[contractKey as keyof TContractEnum]
}

/**
 * Maps a gRPC enum value to its corresponding Prisma database enum value.
 *
 * Extracts the semantic suffix from Contract enum keys (e.g., `PROVIDER_GITHUB` → `GITHUB`)
 * to match against Prisma enum values. This reverses the transformation performed by
 * {@link mapPrismaToContract}.
 *
 * @template TContractEnum - The Contract/Protocol Buffer enum type (Record<string, string | number>)
 * @template TPrismaEnum - The Prisma enum type (Record<string, string>)
 *
 * @param contractValue - The string value from Contract enum (e.g., "PROVIDER_GITHUB")
 * @param contractEnum - The Contract enum object (used for type inference context)
 * @param prismaEnum - The Prisma enum object containing database-level values
 *
 * @returns The matching Prisma enum value (e.g., "GITHUB")
 *
 * @throws {Error} If the contractValue is a number enum (not supported)
 * @throws {Error} When no Prisma enum key matches the extracted suffix
 *
 * @example
 * ```typescript
 * // Reverse mapping from Contract to Prisma
 * const dbValue = mapContractToPrisma(
 *   'PROVIDER_GITHUB',
 *   AuthProvider,
 *   PrismaProvider
 * ); // Returns: 'GITHUB'
 *
 * // Also works without prefix
 * mapContractToPrisma('GITHUB', AuthProvider, PrismaProvider); // Returns: 'GITHUB'
 * ```
 */
export function mapContractToPrisma<
	TContractEnum extends Record<string, string | number>,
	TPrismaEnum extends Record<string, string>
>(
	contractValue: TContractEnum[keyof TContractEnum],
	contractEnum: TContractEnum,
	prismaEnum: TPrismaEnum
): TPrismaEnum[keyof TPrismaEnum] {
	if (typeof contractValue === "number") {
		throw new Error(
			"Number enums are not supported. Check src/infrastructure/grpc/grpc.options"
		)
	}

	const suffix = contractValue.includes("_")
		? contractValue.split("_").pop()?.toUpperCase()
		: contractValue.toUpperCase()

	const prismaKey = Object.keys(prismaEnum).find(
		key => key.toUpperCase() === suffix
	)

	if (!prismaKey) {
		throw new Error(
			`No matching Prisma enum value found for contract key: ${contractValue}.\nExtracted suffix: ${suffix}, Available Prisma keys: ${Object.keys(prismaEnum).join(", ")}`
		)
	}

	return prismaEnum[prismaKey as keyof TPrismaEnum]
}
