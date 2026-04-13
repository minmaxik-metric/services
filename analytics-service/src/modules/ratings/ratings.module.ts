import { Module } from "@nestjs/common"

import { RatingCalculationModule } from "@/modules/rating-calculation/rating-calculation.module"
import { RatingStorageModule } from "@/modules/rating-storage/rating-storage.module"
import { ScoringProfilesModule } from "@/modules/scoring-profiles/scoring-profiles.module"

import { RatingsController } from "./ratings.controller"
import { RatingsService } from "./ratings.service"

@Module({
	imports: [
		RatingCalculationModule,
		RatingStorageModule,
		ScoringProfilesModule
	],
	controllers: [RatingsController],
	providers: [RatingsService]
})
export class RatingsModule {}
