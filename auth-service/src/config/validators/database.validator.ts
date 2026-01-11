import { IsString } from "class-validator"

export class DatabaseValidator {
	@IsString()
	public DATABASE_URI: string
}
