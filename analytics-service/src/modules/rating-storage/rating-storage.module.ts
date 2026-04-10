import { Module } from "@nestjs/common"

import { RatingsRepository } from "./ratings.repository"

@Module({
	providers: [RatingsRepository],
	exports: [RatingsRepository]
})
export class RatingStorageModule {}
