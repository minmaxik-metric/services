import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { isSupervisor } from "@/entities/user/model/types";
import { useSessionStore } from "@/features/auth/model/session-store";
import { AuthCallbackPage } from "@/pages/auth-callback/auth-callback-page";
import { DashboardPage } from "@/pages/dashboard/dashboard-page";
import { LeaderboardPage } from "@/pages/leaderboard/leaderboard-page";
import { LoginPage } from "@/pages/login/login-page";
import {
  RepositoriesPage,
  RepositoryDetailPage,
} from "@/pages/repositories/repositories-page";
import { WeightsPage } from "@/pages/weights/weights-page";
import { AppShell } from "@/widgets/app-shell/app-shell";
import { EmptyState } from "@/shared/ui/empty-state";

const rootRoute = createRootRoute({
  component: RootComponent,
  notFoundComponent: () => (
    <main className="grid min-h-screen place-items-center p-4">
      <EmptyState title="Страница не найдена" />
    </main>
  ),
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const callbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth/callback",
  component: AuthCallbackPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: requireAuth,
  component: () => (
    <AppShell>
      <DashboardPage />
    </AppShell>
  ),
});

const leaderboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/leaderboard",
  beforeLoad: requireAuth,
  component: () => (
    <AppShell>
      <LeaderboardPage />
    </AppShell>
  ),
});

const repositoriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/repositories",
  beforeLoad: requireAuth,
  component: () => (
    <AppShell>
      <RepositoriesPage />
    </AppShell>
  ),
});

const repositoryDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/repositories/$repositoryId",
  beforeLoad: requireAuth,
  component: RepositoryDetailRouteComponent,
});

const weightsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/weights",
  beforeLoad: async (location) => {
    await requireAuth(location);

    const user = useSessionStore.getState().user;

    if (!isSupervisor(user?.role)) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <AppShell>
      <WeightsPage />
    </AppShell>
  ),
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  callbackRoute,
  dashboardRoute,
  leaderboardRoute,
  repositoriesRoute,
  repositoryDetailRoute,
  weightsRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function RootComponent() {
  return (
    <>
      <Outlet />
      {import.meta.env.DEV ? (
        <TanStackRouterDevtools position="bottom-right" />
      ) : null}
    </>
  );
}

function RepositoryDetailRouteComponent() {
  const { repositoryId } = repositoryDetailRoute.useParams();

  return (
    <AppShell>
      <RepositoryDetailPage repositoryId={repositoryId} />
    </AppShell>
  );
}

async function requireAuth({ location }: { location: { href: string } }) {
  const session = useSessionStore.getState();

  if (session.status === "idle") {
    await session.bootstrap();
  }

  const next = useSessionStore.getState();

  if (next.status !== "authenticated") {
    throw redirect({
      to: "/login",
      search: {
        redirect: location.href,
      },
    });
  }
}
