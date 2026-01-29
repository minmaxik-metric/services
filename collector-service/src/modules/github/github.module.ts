import { Module } from "@nestjs/common"

import { GithubPollingModule } from "./polling/github-polling.module"
import { GithubWebhookModule } from "./webhook/github-webhook.module"

@Module({
	imports: [GithubPollingModule, GithubWebhookModule]
})
export class GithubModule {}
