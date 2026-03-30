import { Module } from "@nestjs/common"

import { ScoringProfilesService } from "./scoring-profiles.service"

@Module({
	providers: [ScoringProfilesService],
	exports: [ScoringProfilesService]
})
export class ScoringProfilesModule {}
