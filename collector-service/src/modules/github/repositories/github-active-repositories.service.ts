import { Injectable, Logger } from "@nestjs/common"

import { MongoService } from "@/infrastructure/mongo/mongodb.service"
import {
	ActiveRepository,
	ActiveRepositoryStatus
} from "@/infrastructure/mongo/schemas"

export interface GithubRepositoryOwnerInput {
	id?: number | string | null
	nodeId?: string | null
	login: string
	url?: string | null
	avatarUrl?: string | null
}

export interface GithubRepositoryTrackingInput {
	id: number
	nodeId: string
	fullName: string
	owner: GithubRepositoryOwnerInput
	name: string
	url?: string | null
	apiUrl?: string | null
	private: boolean
	archived?: boolean
	disabled?: boolean
	defaultBranch?: string | null
}

export interface GithubActiveRepositoryConfig {
	owner: string
	repo: string
	fullName: string
}

interface TrackRepositoryOptions {
	status?: ActiveRepositoryStatus
	statusReason?: string
	eventName?: string
	activityAt?: Date | null
	preserveTerminalStatus?: boolean
}

const TERMINAL_STATUSES: ActiveRepositoryStatus[] = [
	"archived",
	"deleted",
	"removed",
	"disabled",
	"suspended"
]

@Injectable()
export class GithubActiveRepositoriesService {
	private readonly logger = new Logger(GithubActiveRepositoriesService.name)

	public constructor(private readonly mongoService: MongoService) {}

	public async getActiveRepositories(): Promise<GithubActiveRepositoryConfig[]> {
		const repositories = await this.mongoService.activeRepositories
			.find({ status: "active" })
			.sort({ full_name: 1 })
			.lean()
			.exec()

		return repositories.map(repository => ({
			owner: repository.owner,
			repo: repository.name,
			fullName: repository.full_name
		}))
	}

	public async markRepositoryActive(
		repository: GithubRepositoryTrackingInput,
		eventName: string
	) {
		return this.trackRepository(repository, {
			status: "active",
			statusReason: eventName,
			eventName
		})
	}

	public async markRepositoryStatus(
		repository: GithubRepositoryTrackingInput,
		status: ActiveRepositoryStatus,
		eventName: string
	) {
		return this.trackRepository(repository, {
			status,
			statusReason: eventName,
			eventName
		})
	}

	public async touchRepositoryActivity(
		repository: GithubRepositoryTrackingInput,
		eventName: string,
		activityAt: Date = new Date()
	) {
		return this.trackRepository(repository, {
			status: "active",
			statusReason: eventName,
			eventName,
			activityAt,
			preserveTerminalStatus: true
		})
	}

	public async markOwnerRepositoriesStatus(
		owner: string,
		status: ActiveRepositoryStatus,
		eventName: string,
		fromStatuses?: ActiveRepositoryStatus[]
	) {
		const now = new Date()
		const filter: Record<string, unknown> = { owner }

		if (fromStatuses?.length) {
			filter.status = { $in: fromStatuses }
		}

		const result = await this.mongoService.activeRepositories.updateMany(
			filter,
			{
				$set: {
					status,
					status_changed_at: now,
					status_reason: eventName,
					last_webhook_at: now,
					last_webhook_event: eventName
				}
			}
		)

		this.logger.log(
			`Marked ${result.modifiedCount} repository(ies) for ${owner} as ${status}`
		)
	}

	private async trackRepository(
		repository: GithubRepositoryTrackingInput,
		options: TrackRepositoryOptions
	) {
		const now = new Date()
		const nextStatus = this.resolveStatus(repository, options.status)
		const existing = await this.mongoService.activeRepositories
			.findOne({ repository_id: repository.id })
			.select("status status_changed_at")
			.lean()
			.exec()
		const shouldPreserveStatus =
			options.preserveTerminalStatus &&
			existing?.status &&
			TERMINAL_STATUSES.includes(existing.status)
		const update = this.buildRepositoryUpdate(repository, options, now)

		if (!shouldPreserveStatus) {
			update.status = nextStatus
			update.status_reason = options.statusReason ?? options.eventName ?? null

			if (
				!existing ||
				existing.status !== nextStatus ||
				!existing.status_changed_at
			) {
				update.status_changed_at = now
			}
		}

		return this.mongoService.activeRepositories.findOneAndUpdate(
			{ repository_id: repository.id },
			{
				$set: update
			},
			{
				upsert: true,
				returnDocument: "after"
			}
		)
	}

	private buildRepositoryUpdate(
		repository: GithubRepositoryTrackingInput,
		options: TrackRepositoryOptions,
		now: Date
	): Partial<ActiveRepository> {
		const ownerUrl =
			repository.owner.url ?? `https://github.com/${repository.owner.login}`

		const update: Partial<ActiveRepository> = {
			repository_id: repository.id,
			node_id: repository.nodeId,
			full_name: repository.fullName,
			owner: repository.owner.login,
			name: repository.name,
			url: repository.url ?? `https://github.com/${repository.fullName}`,
			api_url: repository.apiUrl ?? null,
			is_private: repository.private,
			archived: repository.archived ?? false,
			disabled: repository.disabled ?? false,
			default_branch: repository.defaultBranch ?? null,
			last_webhook_at: now,
			last_webhook_event: options.eventName ?? null,
			owner_info: {
				id:
					repository.owner.id === undefined || repository.owner.id === null
						? null
						: String(repository.owner.id),
				node_id: repository.owner.nodeId ?? null,
				login: repository.owner.login,
				url: ownerUrl,
				avatar_url: repository.owner.avatarUrl ?? null
			}
		}

		if (options.activityAt) {
			update.last_activity_at = options.activityAt
		}

		return update
	}

	private resolveStatus(
		repository: GithubRepositoryTrackingInput,
		requestedStatus?: ActiveRepositoryStatus
	): ActiveRepositoryStatus {
		if (requestedStatus) return requestedStatus
		if (repository.disabled) return "disabled"
		if (repository.archived) return "archived"
		return "active"
	}
}
