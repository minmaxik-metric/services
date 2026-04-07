import { Module } from "@nestjs/common"

import { MetricSourceModule } from "@/modules/metric-source/metric-source.module"
import { RatingStorageModule } from "@/modules/rating-storage/rating-storage.module"
import { ScoringProfilesModule } from "@/modules/scoring-profiles/scoring-profiles.module"
import { ScoringModule } from "@/modules/scoring/scoring.module"

import { RatingCalculationService } from "./rating-calculation.service"

@Module({
	imports: [
		MetricSourceModule,
		ScoringModule,
		ScoringProfilesModule,
		RatingStorageModule
	],
	providers: [RatingCalculationService],
	exports: [RatingCalculationService]
})
export class RatingCalculationModule {}
