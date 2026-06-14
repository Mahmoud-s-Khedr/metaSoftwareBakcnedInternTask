# Personal Blogging Platform REST API

A production-style REST API for a personal blogging platform, built as an internship task for MetaSoftware. The project demonstrates real-world backend engineering practices: rotating opaque refresh tokens, Zod-validated request bodies, Prisma-managed migrations, layered testing (unit → integration → E2E), Dockerized execution, OpenAPI docs, and a GitHub Actions CI pipeline.

---

## Live links

- **Live API:** https://metasoftwarebakcnedinterntask-production.up.railway.app
- **Swagger UI:** https://metasoftwarebakcnedinterntask-production.up.railway.app/docs
- **GitHub Repository:** https://github.com/Mahmoud-s-Khedr/metaSoftwareBakcnedInternTask

---

## Table of contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Project structure](#project-structure)
4. [Database schema](#database-schema)
5. [Authentication design](#authentication-design)
6. [Refresh-token rotation and reuse detection](#refresh-token-rotation-and-reuse-detection)
7. [API endpoints](#api-endpoints)
8. [Request & response format](#request--response-format)
9. [Validation and error handling](#validation-and-error-handling)
10. [Testing strategy](#testing-strategy)
11. [Docker setup](#docker-setup)
12. [Environment variables](#environment-variables)
13. [Local setup (without Docker)](#local-setup-without-docker)
14. [Running tests](#running-tests)
15. [Swagger / OpenAPI docs](#swagger--openapi-docs)
16. [Deployment on Railway](#deployment-on-railway)
17. [Security notes](#security-notes)

---

## Features

- **User authentication** — register, login, logout, logout-all
- **Rotating opaque refresh tokens** — refresh tokens are stored hashed, rotated on every use, and the entire token family is revoked if a reused token is detected
- **Short-lived JWT access tokens** — 15-minute expiry, verified on every protected request
- **Posts CRUD** — create, list (paginated), update, delete with per-resource ownership enforcement
- **Zod validation** — every request body and query string is validated and coerced before it reaches a controller
- **Consistent error envelope** — every error response follows the same JSON shape
- **Auto-generated OpenAPI docs** — Swagger UI at `/docs`, derived at runtime from Express routes and Zod schemas, no duplication
- **Layered test suite** — 63 tests across unit, integration, and E2E layers
- **Docker Compose** — one command to start the API and a fresh PostgreSQL database
- **GitHub Actions CI** — lint, build, migrate, and test on every push/PR to `master`

---

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 |
| Language | TypeScript 5 |
| Framework | Express 4 |
| Database | PostgreSQL 16 |
| ORM / migrations | Prisma 6 |
| Validation | Zod 3 |
| Password hashing | bcrypt |
| Access tokens | JSON Web Tokens (jsonwebtoken) |
| Refresh tokens | `crypto.randomBytes` + HMAC-SHA256 hash |
| Testing | Jest 29 + Supertest 7 + ts-jest |
| Docs | swagger-ui-express + zod-to-json-schema |
| Containerization | Docker + Docker Compose |
| CI | GitHub Actions |
| Deployment | Railway |

---

## Project structure

```
.
├── src/
│   ├── app.ts                   # Express app factory
│   ├── server.ts                # HTTP server entry point
│   ├── config/
│   │   ├── env.ts               # Zod-validated environment config
│   │   ├── prisma.ts            # Prisma client singleton
│   │   └── swagger.ts           # OpenAPI spec generator
│   ├── routes/
│   │   ├── health.routes.ts
│   │   ├── auth.routes.ts
│   │   └── post.routes.ts
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   └── post.controller.ts
│   ├── services/
│   │   ├── auth.service.ts      # Register, login, refresh, logout logic
│   │   ├── token.service.ts     # JWT + refresh-token helpers
│   │   └── post.service.ts      # Post CRUD with ownership checks
│   ├── middlewares/
│   │   ├── auth.middleware.ts   # JWT Bearer verification
│   │   ├── validate.middleware.ts
│   │   └── error.middleware.ts  # Global error handler + 404
│   ├── validators/
│   │   ├── auth.validator.ts
│   │   ├── post.validator.ts
│   │   └── pagination.validator.ts
│   ├── types/                   # Express req.user augmentation
│   └── utils/
│       ├── errors.ts            # AppError class
│       └── async-handler.ts     # Wraps async route handlers
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── tests/
│   ├── unit/
│   │   ├── auth.service.test.ts
│   │   ├── token.service.test.ts
│   │   ├── validators.test.ts
│   │   └── error-handler.test.ts
│   ├── integration/
│   │   ├── auth.routes.test.ts
│   │   └── posts.routes.test.ts
│   ├── e2e/
│   │   └── blog.e2e.test.ts
│   └── helpers/
│       ├── db.ts                # Connect / clear / disconnect test DB
│       └── auth.ts              # registerAndLogin() helper
├── Dockerfile
├── docker-compose.yml
├── docker-compose.test.yml
├── .github/workflows/ci.yml
└── .env.example
```

---

## Database schema

Three models with two one-to-many relationships: a `User` owns many `Post`s and many `RefreshToken`s. The `RefreshToken` model tracks token families for reuse detection.

```mermaid
erDiagram
    User {
        string id PK
        string name
        string email
        string passwordHash
        datetime createdAt
        datetime updatedAt
    }

    Post {
        string id PK
        string title
        string content
        string authorId FK
        datetime createdAt
        datetime updatedAt
    }

    RefreshToken {
        string id PK
        string tokenHash
        string userId FK
        string familyId
        datetime expiresAt
        datetime revokedAt
        string replacedByTokenId FK
        string userAgent
        string ipAddress
        datetime createdAt
        datetime updatedAt
    }

    User ||--o{ Post : "owns"
    User ||--o{ RefreshToken : "has"
    RefreshToken ||--o| RefreshToken : "replaced by"
```

> **`passwordHash`** is never returned in any API response.  
> **`tokenHash`** stores only an HMAC-SHA256 hash of the raw token — the raw value is never persisted.

---

## Why PostgreSQL?

PostgreSQL was chosen over alternatives (SQLite, MongoDB, MySQL) for the following reasons:

| Reason | Detail |
|---|---|
| **Relational ownership rules** | The data has strict foreign-key relationships: one `User` owns many `Post`s, and one `User` has many `RefreshToken` sessions. A relational database enforces these constraints at the schema level with `REFERENCES` and `ON DELETE CASCADE`, making it impossible to create orphaned posts or dangling token records. |
| **ACID transactions** | Token rotation (mark old token revoked + insert replacement) must be atomic. PostgreSQL's transaction support ensures that a crash between the two writes cannot leave the database in a half-rotated state. |
| **Prisma first-class support** | Prisma's migration toolchain (`migrate dev` / `migrate deploy`) works most reliably with PostgreSQL, and the generated client takes advantage of Postgres-specific optimisations. |
| **Production readiness** | PostgreSQL is the standard choice for production Node.js backends deployed on platforms like Railway. It handles concurrent connections, has mature indexing, and is available as a managed service everywhere. |
| **Not MongoDB** | The data is inherently relational (ownership, foreign keys, referential integrity). A document store would require manual enforcement of those constraints in application code, which is error-prone. |


---

## Authentication design

```mermaid
sequenceDiagram
    participant C as Client
    participant API as Express API
    participant DB as PostgreSQL

    Note over C,DB: Register
    C->>API: POST /auth/register {name, email, password}
    API->>DB: INSERT User (passwordHash = bcrypt(password))
    DB-->>API: User row
    API-->>C: 201 {user} (no passwordHash)

    Note over C,DB: Login
    C->>API: POST /auth/login {email, password}
    API->>DB: SELECT User WHERE email=...
    DB-->>API: User row
    API->>API: bcrypt.compare(password, passwordHash)
    API->>API: generateAccessToken (JWT, 15m)
    API->>API: generateRefreshToken (crypto.randomBytes)
    API->>DB: INSERT RefreshToken (tokenHash=HMAC(rawToken))
    DB-->>API: RefreshToken row
    API-->>C: 200 {accessToken, refreshToken}

    Note over C,DB: Protected request
    C->>API: POST /posts (Authorization: Bearer <accessToken>)
    API->>API: jwt.verify(accessToken) → req.user
    API->>DB: INSERT Post
    DB-->>API: Post row
    API-->>C: 201 {post}
```

### Token lifetimes

| Token | Type | Lifetime | Storage |
|---|---|---|---|
| Access token | JWT (signed) | 15 minutes | Client only |
| Refresh token | Opaque random | 7 days | Client (raw) + DB (HMAC hash) |

---

## Refresh-token rotation and reuse detection

Every call to `POST /auth/refresh` rotates the token: the old token is revoked and a new one is issued. This limits the window of exposure if a token is stolen.

```mermaid
sequenceDiagram
    participant C as Client
    participant API as Express API
    participant DB as PostgreSQL

    Note over C,DB: Normal rotation
    C->>API: POST /auth/refresh {refreshToken: A}
    API->>API: hash(A) → tokenHash
    API->>DB: SELECT RefreshToken WHERE tokenHash=...
    DB-->>API: Token A record (active)
    API->>DB: BEGIN TRANSACTION
    API->>DB: INSERT RefreshToken B (new)
    API->>DB: UPDATE Token A SET revokedAt=now, replacedByTokenId=B.id
    API->>DB: COMMIT
    API-->>C: 200 {accessToken, refreshToken: B}

    Note over C,DB: Reuse detection (token A used again)
    C->>API: POST /auth/refresh {refreshToken: A}
    API->>DB: SELECT RefreshToken WHERE tokenHash=hash(A)
    DB-->>API: Token A record (revokedAt IS NOT NULL)
    API->>DB: UPDATE all tokens WHERE familyId=A.familyId SET revokedAt=now
    API-->>C: 401 Refresh token reuse detected
    Note over C: User must log in again
```

**Why families?** When a revoked token is presented again, it signals potential token theft. Revoking the entire `familyId` group invalidates all tokens derived from that original login session — including the attacker's copy.

---

## API endpoints

> **Base URL (local):** `http://localhost:3000`  
> **Auth:** routes marked **Bearer** require `Authorization: Bearer <accessToken>` in the request header.

---

### `POST /auth/register`

Create a new user account. Passwords are hashed with bcrypt before storage.

**Request body**
```json
{ "name": "Alice", "email": "alice@example.com", "password": "password123" }
```
**Response `201`**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": { "user": { "id": "clx...", "name": "Alice", "email": "alice@example.com", "createdAt": "...", "updatedAt": "..." } }
}
```
**Errors:** `400` validation failed · `409` email already in use

---

### `POST /auth/login`

Authenticate and receive a short-lived access token and a rotating refresh token.

**Request body**
```json
{ "email": "alice@example.com", "password": "password123" }
```
**Response `200`**
```json
{
  "success": true,
  "message": "User logged in successfully",
  "data": {
    "user": { "id": "clx...", "name": "Alice", "email": "alice@example.com", "createdAt": "...", "updatedAt": "..." },
    "accessToken": "eyJ...",
    "refreshToken": "opaque-random-token"
  }
}
```
**Errors:** `400` validation failed · `401` wrong credentials

---

### `POST /auth/refresh`

Exchange a valid refresh token for a new access token + new refresh token. The old refresh token is immediately revoked. Reusing a revoked token revokes the entire token family.

**Request body**
```json
{ "refreshToken": "opaque-random-token" }
```
**Response `200`** — same shape as login (`accessToken` + `refreshToken`)

**Errors:** `400` validation · `401` invalid / expired / revoked token

---

### `POST /auth/logout`

Revoke a single refresh token (current session).

**Request body**
```json
{ "refreshToken": "opaque-random-token" }
```
**Response `200`**
```json
{ "success": true, "message": "User logged out successfully" }
```

---

### `POST /auth/logout-all` 🔒 Bearer

Revoke all active refresh tokens for the authenticated user (all devices / sessions).

**Headers:** `Authorization: Bearer <accessToken>`  
**Response `200`**
```json
{ "success": true, "message": "All sessions revoked successfully" }
```
**Errors:** `401` missing or invalid access token

---

### `GET /posts`

Public paginated list of posts. Each post includes the author's public profile fields (`id` and `name` only — no `passwordHash`, no `email`).

**Query params**

| Param | Type | Default | Max |
|---|---|---|---|
| `page` | integer | `1` | — |
| `limit` | integer | `10` | `100` |

**Example:** `GET /posts?page=1&limit=5`

**Response `200`**
```json
{
  "success": true,
  "message": "Posts retrieved successfully",
  "data": {
    "posts": [
      {
        "id": "clx...",
        "title": "Hello World",
        "content": "My first post",
        "authorId": "clx...",
        "author": { "id": "clx...", "name": "Alice" },
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "pagination": { "page": 1, "limit": 5, "total": 23, "totalPages": 5 }
  }
}
```

---

### `POST /posts` 🔒 Bearer

Create a new post. The post is automatically linked to the authenticated user.

**Headers:** `Authorization: Bearer <accessToken>`  
**Request body**
```json
{ "title": "Hello World", "content": "My first post" }
```
**Response `201`**
```json
{
  "success": true,
  "message": "Post created successfully",
  "data": { "post": { "id": "clx...", "title": "Hello World", "content": "My first post", "author": { ... }, "createdAt": "...", "updatedAt": "..." } }
}
```
**Errors:** `400` validation (empty title/content) · `401` missing token

---

### `PUT /posts/:id` 🔒 Bearer

Update a post. Only the post owner can update — any other authenticated user receives `403`.

**Headers:** `Authorization: Bearer <accessToken>`  
**Request body** (all fields optional)
```json
{ "title": "Updated title", "content": "Updated content" }
```
**Response `200`** — updated post in `data.post`  
**Errors:** `400` validation · `401` missing token · `403` not the owner · `404` post not found

---

### `DELETE /posts/:id` 🔒 Bearer

Delete a post. Only the post owner can delete.

**Headers:** `Authorization: Bearer <accessToken>`  
**Response `200`**
```json
{ "success": true, "message": "Post deleted successfully" }
```
**Errors:** `401` missing token · `403` not the owner · `404` post not found

---

### `GET /health`

```json
{ "success": true, "message": "API is healthy" }
```

---

### `GET /docs`

Swagger UI — interactive browser for all endpoints.  
Also available as raw JSON at `GET /docs.json`.


---

## Request & response format

### Success envelope

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "clx...",
      "name": "Alice",
      "email": "alice@example.com",
      "createdAt": "2026-06-14T00:00:00.000Z",
      "updatedAt": "2026-06-14T00:00:00.000Z"
    }
  }
}
```

### Error envelope

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    "email: Invalid email",
    "password: String must contain at least 8 character(s)"
  ]
}
```

### Status codes

| Code | Meaning |
|---|---|
| `200` | Successful read / update / delete / logout |
| `201` | Successful create (register, create post) |
| `400` | Validation error |
| `401` | Missing, invalid, or expired token; wrong credentials |
| `403` | Authenticated but not the resource owner |
| `404` | Resource not found |
| `409` | Conflict (duplicate email) |
| `500` | Unexpected server error |

### Pagination (GET /posts)

| Query param | Default | Description |
|---|---|---|
| `page` | `1` | Page number (positive integer) |
| `limit` | `10` | Items per page (1–100) |

```
GET /posts?page=2&limit=5
```

```json
{
  "success": true,
  "message": "Posts retrieved successfully",
  "data": {
    "posts": [...],
    "pagination": {
      "page": 2,
      "limit": 5,
      "total": 23,
      "totalPages": 5
    }
  }
}
```

---

## Validation and error handling

All validation is done with **Zod** before the request reaches the controller. The `validateMiddleware` factory wraps any Zod schema and can target `body`, `query`, or `params`.

```mermaid
flowchart LR
    Req[HTTP Request] --> Auth{Auth middleware\nrequired?}
    Auth -- yes --> JWT[Verify JWT\nBearer token]
    JWT -- invalid --> E401[401 AppError]
    JWT -- valid --> Val
    Auth -- no --> Val{Validation\nmiddleware?}
    Val -- yes --> Zod[Zod safeParse]
    Zod -- fail --> E400[400 AppError]
    Zod -- pass --> Ctrl[Controller]
    Val -- no --> Ctrl
    Ctrl --> Svc[Service]
    Svc -- throws AppError --> ErrMw[Error middleware]
    Svc -- ok --> Res[JSON response]
    ErrMw --> Res
    E400 --> ErrMw
    E401 --> ErrMw
```

### Validation rules

| Schema | Rules |
|---|---|
| `registerSchema` | `name` non-empty, `email` valid format, `password` ≥ 8 chars |
| `loginSchema` | `email` valid format, `password` non-empty |
| `refreshTokenSchema` | `refreshToken` non-empty string |
| `logoutSchema` | alias of `refreshTokenSchema` |
| `createPostSchema` | `title` non-empty (trimmed), `content` non-empty (trimmed) |
| `updatePostSchema` | same as create but all fields optional |
| `paginationSchema` | `page` positive int (default 1), `limit` 1–100 (default 10) |

---

## Testing strategy

The test suite is organized into three layers. Integration and E2E tests run against a real PostgreSQL database (isolated ephemeral instance in Docker / CI). Unit tests are isolated and mock external dependencies such as Prisma.

```mermaid
graph TB
    subgraph Unit["Unit tests (4 files, 32 tests)"]
        direction LR
        U1[auth.service — password hashing & login]
        U2[token.service — JWT & refresh token]
        U3[validators — post & pagination schemas]
        U4[error-handler — 400 / 401 / 403 / 500]
    end

    subgraph Integration["Integration tests (3 files, 18 tests)"]
        direction LR
        I1[auth.routes — register / login / refresh / logout]
        I2[posts.routes — CRUD, auth, ownership, 404]
        I3[app — health, Swagger, 404, error middleware]
    end

    subgraph E2E["E2E tests (1 file, 3 scenarios)"]
        direction LR
        E1[Full lifecycle — register → post → update → delete]
        E2[Ownership — user B cannot touch user A posts]
        E3[Token rotation — reuse detection revokes family]
    end

    Unit --> Integration --> E2E
```

### Test counts

| Layer | Test files | Tests |
|---|---:|---:|
| Unit | 4 | 32 |
| Integration | 3 | 18 |
| E2E | 1 | 3 scenarios (13 assertions) |
| **Total** | **8 files** | **63 tests** |

### Key test patterns

- **Unit tests** mock Prisma with `jest.mock` — zero database dependency
- **Integration tests** use Supertest + a real DB; each test suite clears tables in `beforeEach`
- **E2E tests** use the same stack but test full user journeys end-to-end
- The `registerAndLogin()` helper (`tests/helpers/auth.ts`) eliminates boilerplate across suites

---

## Docker setup

### Development

Starts the API and a persistent PostgreSQL database. Hot-reload via `tsx watch`.

```bash
# Start
docker compose up --build

# API is available at http://localhost:3000
# Postgres is exposed on host port 5433 (avoids conflicts with local Postgres)
```

The `docker-compose.yml` automatically runs `prisma migrate deploy` on startup, so the database is always up to date.

### Testing

Starts an isolated, disposable PostgreSQL database, runs all migrations, then runs the full Jest suite. Exits with Jest's exit code.

```bash
# Run the full test suite
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from api-test

# Tear down and remove the test database volume
docker compose -f docker-compose.test.yml down -v
```

### CI (GitHub Actions)

The CI pipeline uses a native PostgreSQL **service container** (no Docker-in-Docker required):

```
push / PR to master
      │
      ▼
  Checkout + Node 22 + npm cache
      │
      ├─ npm ci
      ├─ npm run lint
      ├─ npm run build
      ├─ npx prisma migrate deploy
      └─ npm test  ──▶  63 tests (unit + integration + e2e)
```

---

## Environment variables

Copy `.env.example` and fill in real values:

```bash
cp .env.example .env
```

| Variable | Example | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |
| `PORT` | `3000` | HTTP port the server listens on |
| `DATABASE_URL` | `postgresql://user:password@localhost:5432/blog_db` | Prisma connection string |
| `JWT_ACCESS_SECRET` | *(≥ 32 random chars)* | Signs JWT access tokens |
| `REFRESH_TOKEN_SECRET` | *(≥ 32 random chars, different from above)* | HMAC key for hashing refresh tokens |
| `ACCESS_TOKEN_EXPIRES_IN` | `15m` | JWT expiry (e.g. `15m`, `1h`) |
| `REFRESH_TOKEN_EXPIRES_IN_DAYS` | `7` | Refresh token lifetime in days |

> **Never commit `.env` to version control.** Generate secrets with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
> ```

---

## Local setup

There are two ways to run the project locally. **Option A (Docker)** is the fastest — no manual PostgreSQL installation needed.

---

### Option A — Docker (recommended)

**Prerequisites:** Docker + Docker Compose

```bash
# 1. Clone the repository
git clone https://github.com/Mahmoud-s-Khedr/metaSoftwareBakcnedInternTask.git
cd metaSoftwareBakcnedInternTask

# 2. Start the API + PostgreSQL (migrations run automatically)
docker compose up --build
```

The API is available at **`http://localhost:3000`**.  
Postgres is exposed on the host at port `5433` (to avoid conflicts with a locally installed PostgreSQL).

To stop and remove containers:
```bash
docker compose down
```

---

### Option B — Manual (Node.js + local PostgreSQL)

**Prerequisites:** Node.js ≥ 22, PostgreSQL 16

```bash
# 1. Clone the repository
git clone https://github.com/Mahmoud-s-Khedr/metaSoftwareBakcnedInternTask.git
cd metaSoftwareBakcnedInternTask

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_ACCESS_SECRET, REFRESH_TOKEN_SECRET

# 4. Apply database migrations
npx prisma migrate deploy

# 5. Start the development server (hot-reload via tsx watch)
npm run dev
```

The API is available at **`http://localhost:3000`**.

---

### Verify the setup

Once the server is running, check that it is healthy:

```bash
curl http://localhost:3000/health
# {"success":true,"message":"API is healthy"}
```

Open **`http://localhost:3000/docs`** in a browser to explore all endpoints via the interactive Swagger UI.


---

## Running tests

### All tests (requires a running PostgreSQL)

```bash
npm test
```

### By layer

```bash
npm run test:unit          # Unit tests only (no DB required)
npm run test:integration   # Integration tests (needs DB)
npm run test:e2e           # E2E tests (needs DB)
```

### Via Docker (recommended — isolated DB)

```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from api-test
```

---

## Other scripts

```bash
npm run build        # Compile TypeScript → dist/
npm run start        # Run compiled output (production)
npm run lint         # ESLint
npm run format       # Prettier

npx prisma migrate dev      # Create and apply a new migration (dev)
npx prisma migrate deploy   # Apply pending migrations (staging/prod/CI)
npx prisma generate         # Regenerate Prisma Client after schema changes
```

---

## Swagger / OpenAPI docs

The OpenAPI spec is generated from route metadata and Zod schemas, reducing duplication between validation rules and API documentation.

- **Swagger UI:** `GET /docs`
- **Raw spec:** `GET /docs.json`

The spec includes request body schemas (derived from Zod), response schemas, bearer auth requirements, and worked examples for every endpoint.

---

## Deployment on Railway

### Setup

1. Create a new project at [railway.app](https://railway.app)
2. Add a **PostgreSQL** database plugin — Railway injects `DATABASE_URL` automatically
3. Connect the GitHub repository as an API service
4. Set the following environment variables in Railway:

```
NODE_ENV=production
JWT_ACCESS_SECRET=<long-random-secret>
REFRESH_TOKEN_SECRET=<different-long-random-secret>
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN_DAYS=7
```

5. Set the build and start commands:

**Build command:**
```bash
npm ci && npx prisma generate && npm run build
```

**Start command:**
```bash
npx prisma migrate deploy && node dist/server.js
```

### Post-deployment smoke test

```bash
BASE=https://your-railway-url.railway.app

curl $BASE/health
curl $BASE/docs
curl $BASE/posts

curl -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Alice","email":"alice@example.com","password":"password123"}'

curl -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"password123"}'
```

---

## Security notes

| Concern | Approach |
|---|---|
| Password storage | bcrypt with 12 salt rounds — no plain-text passwords ever touch the database |
| Access token exposure | Short 15-minute lifetime minimizes damage if a token is stolen |
| Refresh token storage | Raw token is never stored — only an HMAC-SHA256 hash is persisted |
| Refresh token rotation | A new token is issued on every refresh; the old one is immediately revoked |
| Token theft detection | Reuse of a revoked refresh token revokes the entire token family (all sessions from that login) |
| Secret management | All secrets are environment variables; `.env` is in `.gitignore` |
| Author data minimization | Post responses include only the author's public profile fields (`id` and `name`) — `passwordHash` and `email` are never included in public responses |
| Ownership enforcement | Service layer checks `authorId === requesterId` before any mutation; returns 403 otherwise |
