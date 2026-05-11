import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  FolderGit2,
  Gauge,
  LogOut,
  Medal,
  Settings2,
  Sparkles,
} from "lucide-react";
import { type FormEvent, type PropsWithChildren, useState } from "react";

import { isSupervisor, roleLabel } from "@/entities/user/model/types";
import { useSessionStore } from "@/features/auth/model/session-store";
import { RatingsFilter } from "@/widgets/ratings-filter/ratings-filter";
import { apiRequest } from "@/shared/api/client";
import { cn } from "@/shared/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Separator } from "@/shared/ui/separator";

const navigation = [
  { to: "/", label: "Обзор", icon: Gauge, supervisorOnly: false },
  {
    to: "/leaderboard",
    label: "Лидерборд",
    icon: Medal,
    supervisorOnly: false,
  },
  {
    to: "/repositories",
    label: "Репозитории",
    icon: FolderGit2,
    supervisorOnly: false,
  },
  {
    to: "/weights",
    label: "Веса метрик",
    icon: Settings2,
    supervisorOnly: true,
  },
] as const;

export function AppShell({ children }: PropsWithChildren) {
  const { user, logout } = useSessionStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const supervisor = isSupervisor(user?.role);
  const showRatingsFilter = !pathname.startsWith("/weights");
  const [supervisorIdentity, setSupervisorIdentity] = useState("");

  async function addSupervisor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = supervisorIdentity.trim();

    if (!value) return;

    await apiRequest("/analytics/supervisor-pool", {
      method: "POST",
      body: { supervisorIdentity: value },
    });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["analytics"] }),
      queryClient.invalidateQueries({ queryKey: ["ratings"] }),
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] }),
      queryClient.invalidateQueries({ queryKey: ["repositories-page"] }),
      queryClient.invalidateQueries({ queryKey: ["repository-detail"] }),
    ]);
    setSupervisorIdentity("");
  }

  async function handleLogout() {
    await logout();
    await navigate({ to: "/login", replace: true });
  }

  return (
    <div className="min-h-screen p-3 md:p-5">
      <div className="mx-auto grid max-w-[1440px] gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="surface h-fit rounded-3xl p-4 lg:sticky lg:top-5 lg:max-h-[calc(100vh-2.5rem)] lg:overflow-y-auto">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">citec-spbu</p>
              <h1 className="font-semibold tracking-tight">Metric Service</h1>
            </div>
          </div>

          <Separator className="my-4" />

          <nav className="grid gap-1">
            {navigation
              .filter((item) => !item.supervisorOnly || supervisor)
              .map((item) => {
                const Icon = item.icon;
                const active =
                  item.to === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.to);

                return (
                  <Link key={item.to} to={item.to} className="block">
                    <Button
                      variant={active ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start rounded-2xl",
                        active && "bg-accent text-accent-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
          </nav>

          {showRatingsFilter ? (
            <>
              <Separator className="my-4" />
              <RatingsFilter />
            </>
          ) : null}

          <Separator className="my-4" />

          <div className="rounded-2xl border bg-background/60 p-3">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={user?.avatarUrl} alt={user?.username} />
                <AvatarFallback>
                  {user?.username?.slice(0, 2).toUpperCase() ?? "MS"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {user?.username}
                </p>
                <Badge variant={supervisor ? "soft" : "secondary"}>
                  {roleLabel(user?.role)}
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              className="mt-3 w-full justify-start rounded-xl text-muted-foreground"
              onClick={handleLogout}
            >
              <LogOut className="size-4" />
              Выйти
            </Button>
          </div>

          {supervisor ? (
            <form
              className="mt-3 rounded-2xl border bg-background/60 p-3"
              onSubmit={addSupervisor}
            >
              <p className="text-sm font-semibold">Пул супервизоров</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Добавьте GitHub login или ссылку на профиль.
              </p>
              <Input
                className="mt-2 h-10"
                value={supervisorIdentity}
                placeholder="octocat или github.com/octocat"
                onChange={(event) =>
                  setSupervisorIdentity(event.target.value)
                }
              />
              <Button
                className="mt-2 h-10 w-full rounded-xl"
                type="submit"
                disabled={!supervisorIdentity.trim()}
              >
                Добавить
              </Button>
            </form>
          ) : null}
        </aside>

        <main className="min-w-0 space-y-5">
          <div className="surface rounded-3xl p-4 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  Аналитика продуктивности
                </h2>
              </div>
              <Badge variant="outline" className="gap-2 rounded-full px-3 py-1">
                <BarChart3 className="size-3.5" />
                {supervisor ? "Полная декомпозиция" : "Ограниченный обзор"}
              </Badge>
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
