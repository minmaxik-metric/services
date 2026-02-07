import { Controller, Get } from "@nestjs/common"

import { GithubPollingService } from "./github-polling.service"

@Controller("github")
export class GithubPollingController {
	public constructor(private readonly pollingService: GithubPollingService) {}

	@Get("poll")
	public async poll() {
		return this.pollingService.handlePolling()
	}
}
