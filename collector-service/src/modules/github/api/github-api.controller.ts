import { Controller, Get } from "@nestjs/common"

import { GithubApiService } from "./github-api.service"

@Controller("github")
export class GithubApiController {
	public constructor(private readonly apiService: GithubApiService) {}

	@Get("viewer")
	public async getViewer() {
		return this.apiService.getCommits("minmaxik-org", "test", "main")
	}

	@Get("rate")
	public async getRateLimits() {
		return this.apiService.getRateLimits()
	}
}
