import { GitBranch, ShieldCheck } from "lucide-react"

import { GithubLoginButton } from "@/features/auth/ui/github-login-button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from "@/shared/ui/card"

export function LoginPage() {
	return (
		<main className="grid min-h-screen place-items-center p-4">
			<Card className="surface w-full max-w-md rounded-[2rem]">
				<CardHeader className="space-y-4 text-center">
					<div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
						<GitBranch className="size-7" />
					</div>
					<div>
						<CardTitle className="text-3xl tracking-tight">
							Metric Service
						</CardTitle>
						<CardDescription className="mt-2">
							Войдите через GitHub, чтобы открыть аналитику по семестрам.
						</CardDescription>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<GithubLoginButton />
					<div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
						<ShieldCheck className="size-4" />
						Доступ определяется ролью аккаунта.
					</div>
				</CardContent>
			</Card>
		</main>
	)
}
