import type { CodegenConfig } from "@graphql-codegen/cli"
import * as dotenv from "dotenv"

dotenv.config({
	path: ".env.development.local"
})

const config: CodegenConfig = {
	overwrite: true,
	schema: [
		{
			"https://api.github.com/graphql": {
				headers: {
					Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
				}
			}
		}
	],
	documents: ["src/**/*.graphql"],
	ignoreNoDocuments: true,
	generates: {
		"src/modules/github/api/generated/graphql.ts": {
			plugins: ["typescript", "typescript-operations", "typescript-resolvers"],
			config: {
				avoidOptionals: true,
				nonOptionalTypename: true,
				preResolveTypes: true,
				scalars: {
					GitObjectID: "string",
					DateTime: "string",
					Date: "string",
					GitTimestamp: "string",
					URI: "string",
					HTML: "string"
				}
			}
		}
	}
}

export default config
