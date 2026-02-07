import { Module } from "@nestjs/common"

import { GithubActiveRepositoriesService } from "./github-active-repositories.service"

@Module({
	providers: [GithubActiveRepositoriesService],
	exports: [GithubActiveRepositoriesService]
})
export class GithubRepositoriesModule {}
