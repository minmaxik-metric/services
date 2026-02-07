import {
	GithubRepositoryOwnerInput,
	GithubRepositoryTrackingInput
} from "./github-active-repositories.service"

export interface GithubInstallationAccount {
	id?: number | string | null
	node_id?: string | null
	login?: string | null
	html_url?: string | null
	avatar_url?: string | null
}

export interface GithubInstallationRepository {
	id: number
	node_id?: string
	name: string
	full_name?: string
	private: boolean
}

export interface GithubWebhookRepository {
	id: number
	node_id?: string
	name: string
	full_name: string
	private: boolean
	html_url?: string | null
	url?: string | null
	archived?: boolean
	disabled?: boolean
	default_branch?: string | null
	owner?: {
		id?: number | string | null
		node_id?: string | null
		login?: string | null
		html_url?: string | null
		avatar_url?: string | null
	} | null
}

export function mapInstallationAccount(
	account: GithubInstallationAccount
): GithubRepositoryOwnerInput {
	if (!account.login) {
		throw new Error("GitHub installation account login is required")
	}

	return {
		id: account.id ?? null,
		nodeId: account.node_id ?? null,
		login: account.login,
		url: account.html_url ?? `https://github.com/${account.login}`,
		avatarUrl: account.avatar_url ?? null
	}
}

export function mapInstallationRepository(
	repository: GithubInstallationRepository,
	owner: GithubRepositoryOwnerInput
): GithubRepositoryTrackingInput {
	const fullName = repository.full_name ?? `${owner.login}/${repository.name}`

	return {
		id: repository.id,
		nodeId: repository.node_id ?? String(repository.id),
		fullName,
		owner,
		name: repository.name,
		url: `https://github.com/${fullName}`,
		private: repository.private
	}
}

export function mapWebhookRepository(
	repository: GithubWebhookRepository
): GithubRepositoryTrackingInput {
	const ownerLogin = repository.owner?.login ?? repository.full_name.split("/")[0]

	return {
		id: repository.id,
		nodeId: repository.node_id ?? String(repository.id),
		fullName: repository.full_name,
		owner: {
			id: repository.owner?.id ?? null,
			nodeId: repository.owner?.node_id ?? null,
			login: ownerLogin,
			url: repository.owner?.html_url ?? `https://github.com/${ownerLogin}`,
			avatarUrl: repository.owner?.avatar_url ?? null
		},
		name: repository.name,
		url: repository.html_url ?? `https://github.com/${repository.full_name}`,
		apiUrl: repository.url ?? null,
		private: repository.private,
		archived: repository.archived ?? false,
		disabled: repository.disabled ?? false,
		defaultBranch: repository.default_branch ?? null
	}
}
