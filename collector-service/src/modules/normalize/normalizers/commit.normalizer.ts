import { ExtractEvent } from "@citec-spbu/contracts"
import { Injectable } from "@nestjs/common"
import { EmitterWebhookEvent } from "@octokit/webhooks"

import { MongoService } from "@/infrastructure/mongo/mongodb.service"
import { RawEventDocument } from "@/infrastructure/mongo/schemas"
import {
	NormalizedEvent,
	NormalizedEventDocument
} from "@/infrastructure/mongo/schemas/normalized-events.schema"

import {
	GetCommitsResult,
	GithubApiService
} from "../../github/api/github-api.service"

import { BaseNormalizer } from "./base.normalizer"
import { EventNormalizer } from "./types"

@Injectable()
export class CommitNormalizer
	extends BaseNormalizer
	implements EventNormalizer
{
	public constructor(mongoService: MongoService) {
		super(mongoService)
	}

	public async normalize(
		event: RawEventDocument
	): Promise<NormalizedEventDocument> {
		switch (event.method) {
			case "manual":
			case "polling": {
				return await this.normalizePolling(event)
			}
			case "webhook": {
				return await this.normalizeWebhook(event)
			}
		}
	}

	private async normalizePolling(
		event: RawEventDocument
	): Promise<NormalizedEventDocument> {
		const { repository, owner, commit } = event.payload as {
			repository: GetCommitsResult["repository"]
			owner: GetCommitsResult["owner"]
			commit: NonNullable<GetCommitsResult["commits"][number]>
		}

		const query: NormalizedEvent = {
			event_key: commit.oid,
			event_type: "commit.created",
			source: "github",
			repository,
			repositoryOwner: {
				id: owner.id,
				name: owner.login,
				url: owner.url,
				avatarUrl: owner.avatarUrl
			},
			payload: {
				sha: commit.oid,
				author: {
					id: commit.author!.user!.id,
					login: commit.author!.user!.login
				},
				committedAt: new Date(commit.committedDate),
				message: commit.message,
				stats: {
					additions: commit.additions,
					deletions: commit.deletions
				}
			} satisfies ExtractEvent<"commit.created">["payload"]
		}

		return await this.upsert(commit.oid, query)
	}

	private async normalizeWebhook(
		event: RawEventDocument
	): Promise<NormalizedEventDocument> {
		const { repository, commit } = event.payload as {
			repository: EmitterWebhookEvent<"push">["payload"]["repository"]
			commit: Awaited<ReturnType<GithubApiService["getDetailedCommit"]>>
		}

		const query: NormalizedEvent = {
			event_key: commit.sha,
			event_type: "commit.created",
			source: "github",
			repository: this.buildWebhookRepository(repository),
			repositoryOwner: this.buildWebhookRepositoryOwner({
				owner: {
					node_id: repository.owner!.node_id!,
					login: repository.owner!.login,
					url: repository.owner!.url!,
					avatar_url: repository.owner!.avatar_url!
				}
			}),
			payload: {
				sha: commit.sha,
				author: {
					id: commit.author!.node_id,
					login: commit.author!.login
				},
				committedAt: new Date(commit.commit.author!.date!),
				message: commit.commit.message,
				stats: {
					additions: commit.stats!.additions!,
					deletions: commit.stats!.deletions!
				}
			} satisfies ExtractEvent<"commit.created">["payload"]
		}

		return await this.upsert(commit.sha, query)
	}
}
