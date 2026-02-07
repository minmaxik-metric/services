import {
	Controller,
	Headers,
	HttpCode,
	HttpStatus,
	Post,
	Req
} from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"

import { GithubWebhookService } from "./github-webhook.service"

@Controller("webhooks")
export class GithubWebhookController {
	public constructor(
		private readonly githubWebhookService: GithubWebhookService
	) {}

	@Post("github")
	@HttpCode(HttpStatus.OK)
	public async handleGithubWebhook(
		@Req() req: RawBodyRequest<Request>,
		@Headers("x-github-event") eventName: string,
		@Headers("x-github-delivery") deliveryId: string,
		@Headers("x-hub-signature-256") signature256: string
	): Promise<void> {
		const rawBody = req.rawBody
		if (!rawBody) {
			throw new Error(
				"Raw body is required for webhook verification. Enable rawBody in NestFactory.create()."
			)
		}

		const payload = rawBody.toString("utf8")

		await this.githubWebhookService.verifyAndReceive({
			id: deliveryId,
			name: eventName,
			payload,
			signature: signature256
		})
	}
}
