import type { NormalizedEventPublished } from "@citec-spbu/contracts"
import { Injectable } from "@nestjs/common"
import {
	type Prisma,
	Provider,
	Season,
	SemesterAssignmentType
} from "@prisma/generated/client"

import { PrismaService } from "@/infrastructure/prisma/prisma.service"

type PayloadUser = {
	id: string
	login: string
}

type UserRole = "author" | "actor" | "assignee" | "requestedReviewer"
type PayloadWithUsers = Partial<Record<UserRole, PayloadUser>>
type SemesterDescriptor = {
	season: Season
	year: number
	label: string
	startDate: Date
	endDate: Date
}

const USER_ROLES_BY_EVENT_TYPE: Record<
	NormalizedEventPublished["type"],
	readonly UserRole[]
> = {
	"commit.created": ["author"],
	"issue.created": ["author"],
	"issue.state_changed": ["actor"],
	"issue.assigned": ["actor", "assignee"],
	"issue.labeled": ["actor"],
	"issue.typed": ["actor"],
	"issue.commented": ["actor"],
	"pull_request.created": ["author"],
	"pull_request.state_changed": ["actor"],
	"pull_request.assigned": ["actor", "assignee"],
	"pull_request.labeled": ["actor"],
	"pull_request.review_requested": ["actor", "requestedReviewer"],
	"pull_request.reviewed": ["actor"],
	"pull_request.commented": ["actor"]
}

@Injectable()
export class CollectorEventsService {
	public constructor(private readonly prisma: PrismaService) {}

	public async ingestNormalizedEvent(
		event: NormalizedEventPublished
	): Promise<void> {
		const provider = this.mapProvider(event.source)
		const publishedAt = this.parseDate(event.publishedAt, "publishedAt")
		const eventAt = this.extractEventAt(event)

		const organization = await this.upsertOrganization(event, provider)
		const repository = await this.upsertRepository(
			event,
			provider,
			organization.id,
			publishedAt
		)

		const userIdMap = await this.syncUsersAndMemberships(
			event,
			provider,
			repository.id,
			eventAt
		)

		const remappedPayload = this.remapPayloadUserIds(event, userIdMap)
		const payload = this.toPrismaJson(remappedPayload)
		const semester = this.semesterForDate(eventAt)

		await this.prisma.$transaction(async tx => {
			const persistedSemester = await tx.semester.upsert({
				where: {
					season_year: {
						season: semester.season,
						year: semester.year
					}
				},
				create: semester,
				update: {
					label: semester.label,
					startDate: semester.startDate,
					endDate: semester.endDate
				}
			})
			const semesterAssignments = this.semesterAssignments(
				persistedSemester.id,
				organization.id,
				repository.id,
				[...userIdMap.values()]
			)

			await tx.semesterAssignment.createMany({
				data: semesterAssignments,
				skipDuplicates: true
			})
			await tx.metricEvent.deleteMany({
				where: {
					id: event.id,
					eventAt: {
						not: eventAt
					}
				}
			})
			await tx.metricEvent.upsert({
				where: {
					id_eventAt: {
						id: event.id,
						eventAt
					}
				},
				create: {
					id: event.id,
					provider,
					type: event.type,
					eventAt,
					publishedAt,
					organizationId: organization.id,
					repositoryId: repository.id,
					payload
				},
				update: {
					provider,
					type: event.type,
					publishedAt,
					organizationId: organization.id,
					repositoryId: repository.id,
					payload
				}
			})
		})
	}

	private async upsertOrganization(
		event: NormalizedEventPublished,
		provider: Provider
	) {
		return this.prisma.organization.upsert({
			where: {
				provider_externalId: {
					provider,
					externalId: event.repositoryOwner.id
				}
			},
			create: {
				provider,
				externalId: event.repositoryOwner.id,
				name: event.repositoryOwner.name,
				url: event.repositoryOwner.url,
				avatarUrl: event.repositoryOwner.avatarUrl
			},
			update: {
				name: event.repositoryOwner.name,
				url: event.repositoryOwner.url,
				avatarUrl: event.repositoryOwner.avatarUrl
			}
		})
	}

	private async upsertRepository(
		event: NormalizedEventPublished,
		provider: Provider,
		organizationId: string,
		lastSyncedAt: Date
	) {
		return this.prisma.repository.upsert({
			where: {
				provider_externalId: {
					provider,
					externalId: event.repository.id
				}
			},
			create: {
				provider,
				externalId: event.repository.id,
				name: event.repository.name,
				url: event.repository.url,
				organizationId,
				lastSyncedAt
			},
			update: {
				name: event.repository.name,
				url: event.repository.url,
				organizationId,
				lastSyncedAt
			}
		})
	}

	private async syncUsersAndMemberships(
		event: NormalizedEventPublished,
		provider: Provider,
		repositoryId: string,
		joinedAt: Date
	): Promise<Map<string, string>> {
		const users = this.extractUsersFromEvent(event)
		if (users.length === 0) {
			return new Map()
		}

		const userIdMap = new Map<string, string>()
		const membershipData: Prisma.RepositoryMembershipCreateManyInput[] = []

		for (const user of users) {
			const persistedUser = await this.prisma.user.upsert({
				where: {
					provider_externalId: {
						provider,
						externalId: user.id
					}
				},
				create: {
					provider,
					externalId: user.id,
					login: user.login
				},
				update: {
					login: user.login
				}
			})

			userIdMap.set(user.id, persistedUser.id)
			membershipData.push({
				userId: persistedUser.id,
				repositoryId,
				joinedAt
			})
		}

		await this.prisma.repositoryMembership.createMany({
			data: membershipData,
			skipDuplicates: true
		})

		return userIdMap
	}

	private extractUsersFromEvent(
		event: NormalizedEventPublished
	): PayloadUser[] {
		const payload = event.payload as PayloadWithUsers
		const roles = USER_ROLES_BY_EVENT_TYPE[event.type]

		return this.uniqueUsers(
			roles.map(role => payload[role]).filter(Boolean) as PayloadUser[]
		)
	}

	private remapPayloadUserIds(
		event: NormalizedEventPublished,
		userIdMap: Map<string, string>
	): unknown {
		if (userIdMap.size === 0) {
			return event.payload
		}

		const payload = {
			...(event.payload as unknown as Record<string, unknown>)
		}
		const typedPayload = event.payload as PayloadWithUsers
		const roles = USER_ROLES_BY_EVENT_TYPE[event.type]

		for (const role of roles) {
			const user = typedPayload[role]
			if (!user) {
				continue
			}

			payload[role] = this.remapUser(user, userIdMap)
		}

		return payload
	}

	private uniqueUsers(users: PayloadUser[]): PayloadUser[] {
		const usersByExternalId = new Map<string, PayloadUser>()

		for (const user of users) {
			if (!user.id || !user.login) {
				continue
			}

			usersByExternalId.set(user.id, {
				id: user.id,
				login: user.login
			})
		}

		return [...usersByExternalId.values()]
	}

	private remapUser(
		user: PayloadUser,
		userIdMap: Map<string, string>
	): PayloadUser {
		const internalId = userIdMap.get(user.id)

		if (!internalId) {
			return user
		}

		return {
			...user,
			id: internalId
		}
	}

	private mapProvider(source: NormalizedEventPublished["source"]): Provider {
		switch (source) {
			case "github": {
				return Provider.GITHUB
			}
			default: {
				const _exhaustive: never = source
				throw new Error(`Unsupported provider source: ${String(_exhaustive)}`)
			}
		}
	}

	private extractEventAt(event: NormalizedEventPublished): Date {
		const payload = event.payload as unknown as Record<string, unknown>
		const eventAt =
			event.type === "commit.created" ? payload.committedAt : payload.createdAt

		const parsed = this.tryParseDate(eventAt)
		if (parsed) {
			return parsed
		}

		throw new Error(`Invalid event occurrence date for ${event.type}`)
	}

	private parseDate(value: unknown, fieldName: string): Date {
		const parsed = this.tryParseDate(value)
		if (!parsed) {
			throw new Error(`Invalid date value for ${fieldName}`)
		}

		return parsed
	}

	private tryParseDate(value: unknown): Date | null {
		if (value instanceof Date && !Number.isNaN(value.getTime())) {
			return value
		}

		if (typeof value === "string" || typeof value === "number") {
			const parsed = new Date(value)
			if (!Number.isNaN(parsed.getTime())) {
				return parsed
			}
		}

		return null
	}

	private semesterForDate(date: Date): SemesterDescriptor {
		const year = date.getUTCFullYear()
		const month = date.getUTCMonth()

		if (month >= 1 && month <= 7) {
			return this.semesterDescriptor(Season.SPRING, year)
		}

		return this.semesterDescriptor(Season.AUTUMN, month >= 8 ? year : year - 1)
	}

	private semesterDescriptor(season: Season, year: number): SemesterDescriptor {
		const isAutumn = season === Season.AUTUMN
		const startDate = new Date(Date.UTC(year, isAutumn ? 8 : 1, 1))
		const endDate = new Date(
			Date.UTC(isAutumn ? year + 1 : year, isAutumn ? 1 : 8, 1)
		)

		return {
			season,
			year,
			label: `${isAutumn ? "Осенний" : "Весенний"} ${year}`,
			startDate,
			endDate
		}
	}

	private semesterAssignments(
		semesterId: string,
		organizationId: string,
		repositoryId: string,
		userIds: string[]
	): Prisma.SemesterAssignmentCreateManyInput[] {
		const assignments = [
			{
				type: SemesterAssignmentType.ORGANIZATION,
				subjectId: organizationId,
				semesterId
			},
			{
				type: SemesterAssignmentType.REPO,
				subjectId: repositoryId,
				semesterId
			},
			...userIds.map(userId => ({
				type: SemesterAssignmentType.USER,
				subjectId: userId,
				semesterId
			}))
		]

		return [
			...new Map(
				assignments.map(item => [
					`${item.semesterId}:${item.type}:${item.subjectId}`,
					item
				])
			).values()
		]
	}

	private toPrismaJson(value: unknown): Prisma.InputJsonValue {
		return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
	}
}
