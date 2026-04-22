# Metric Service Frontend

React SPA для анализа метрик продуктивности. Стек: React, Vite, Feature-Sliced Design, TanStack Router, TanStack Query, shadcn/ui, Zustand, Tailwind CSS 4.

## Запуск

```bash
cd frontend
npm install
npm run dev
```

По умолчанию приложение работает с gateway на `http://localhost:4000`. Организационный scope фронтенд не задает: gateway берет его из пула организаций супервизора.

```bash
VITE_GATEWAY_URL=http://localhost:4000
```

## Gateway contract

Фронтенд не обращается к внутренним сервисам напрямую. Все запросы идут через `gateway-service`.

Используемые endpoint'ы:

- `GET /auth/github`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /users/@me`
- `GET /analytics/ratings/users`
- `GET /analytics/ratings/repositories`
- `GET /analytics/scoring-profiles`
- `GET /analytics/scoring-profiles/default`
- `PUT /analytics/scoring-profiles/:id`

Для role-based UI `GET /users/@me` возвращает роль аккаунта (`ROLE_USER`, `ROLE_SUPERVISOR` или `ROLE_ADMIN`). Если роль не пришла, фронтенд безопасно считает пользователя студентом.
