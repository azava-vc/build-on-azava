# build-on-azava

Build dashboards, jobs, and internal tools on top of your Azava workspace.

## What this is

A starter template for building custom functionality that connects to [Azava](https://azava.com) via its API. It gives you:

- **A Next.js dashboard** — server components that fetch data directly from the Azava API
- **API routes** — for client-side interactivity when you need it
- **Cron jobs** — scheduled tasks that can read from and write to your workspace
- **Auth** (optional) — "Login with Azava" for internal team tools, so you know who's using them

## Quick start

```bash
# 1. Clone and install
git clone https://github.com/azava-vc/build-on-azava.git my-tool
cd my-tool
npm install

# 2. Configure
cp .env.example .env
# Fill in AZAVA_API_URL and AZAVA_API_KEY from a new API key generated in https://app.azava.com/settings/api-keys

# 3. Fetch your workspace's schema
npm run fetch-schema

# 4. Run the dashboard locally
npm run dev
```

Open [localhost:3000](http://localhost:3000) to see the dashboard.

## How it works

### Pages (server components)

Pages are React server components that fetch data directly from the Azava API. The API key stays server-side automatically.

```typescript
// src/app/my-page/page.tsx
import { azava } from "@/lib/azava";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  const nodes = await azava.nodes({ type: "company", limit: 20 });
  return (
    <ul>
      {nodes.map((n: any) => <li key={n.id}>{n.label}</li>)}
    </ul>
  );
}
```

### API routes (for client-side interactivity)

When you need real-time interactivity (search, filtering, infinite scroll), create an API route:

```typescript
// src/app/api/search/route.ts
import { azava } from "@/lib/azava";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return Response.json(await azava.nodes({ search: searchParams.get("q") ?? "" }));
}
```

### Cron jobs

Each job is a file in `src/jobs/` that exports a default async function:

```typescript
import { azava } from "@/lib/azava";

export default async function myJob() {
  await azava.ingest({ title: "...", content: "...", contentType: "DEALFLOW" });
}
```

Run locally with `npm run job my-job`. Schedule in `render.yaml` for production.

## Authentication

If your tool is for your team's internal use, you can add "Login with Azava" so that only team members can access it.

Auth is controlled by environment variables — set them and the middleware gates all routes automatically. Remove them and the app is fully public. No code changes needed.

### Setup

```bash
# Register your deployment with the Azava platform (one-time)
npm run register https://my-tool.onrender.com
```

This prints two values — add them to your deployment environment along with a session secret:

```
AZAVA_OAUTH_CLIENT_ID=cs_...
AZAVA_OAUTH_CLIENT_SECRET=css_...
SESSION_SECRET=<random string>
```

### Accessing user identity

```typescript
import { getUser } from "@/lib/auth";

export default async function MyPage() {
  const user = await getUser(); // { userId, teamId } or null
  // ...
}
```

## Project structure

```
src/
├── app/              # Next.js App Router
│   ├── layout.tsx    # Root layout
│   ├── page.tsx      # Home page
│   ├── api/          # API routes
│   └── auth/         # OAuth handlers
├── lib/
│   ├── azava.ts      # Azava API client (server-side only)
│   ├── auth.ts       # Session helpers
│   └── notify.ts     # Failure notifications
├── middleware.ts     # Auth gate
├── jobs/             # Cron jobs
├── tools/            # CLI tools (fetch-schema, register)
├── config.ts         # Environment validation
└── run.ts            # Job runner
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run job <name>` | Run a job locally |
| `npm run fetch-schema` | Pull your workspace schema into `data/` |
| `npm run register <url>` | Register OAuth client for a deployment |

## Deploying to Render

The included `render.yaml` defines a web service and a cron job. Push to main to deploy.

Set your environment variables in the Render dashboard under the `azava` env group. If using auth, add the OAuth and session secret vars there too.
