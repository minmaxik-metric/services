import { Module } from "@nestjs/common"

import { GithubApiController } from "./github-api.controller"
import { GithubApiService } from "./github-api.service"

@Module({
	controllers: [GithubApiController],
	providers: [GithubApiService],
	exports: [GithubApiService]
})
export class GithubApiModule {}
