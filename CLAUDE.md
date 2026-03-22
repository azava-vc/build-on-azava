# build-on-azava

This repo is a starter template for building dashboards, jobs, and internal tools on top of an Azava workspace. It connects to Azava via REST API.

## Structure

```
src/
├── app/              # Next.js App Router — pages, layouts, API routes
│   ├── layout.tsx    # Root layout
│   ├── page.tsx      # Home page (server component)
│   ├── api/          # API routes (for client-side data fetching)
│   └── auth/         # OAuth route handlers (login, callback, logout)
├── lib/
│   ├── azava.ts      # Typed Azava API client (server-side only)
│   ├── auth.ts       # Session helpers + getUser()
│   └── notify.ts     # Failure notifications (Slack webhook)
├── jobs/             # Cron jobs — each file exports a default async function
├── tools/
│   ├── fetch-schema.ts  # Pulls live schema into data/
│   └── register.ts      # One-time OAuth client registration
├── middleware.ts     # Auth gate (active only when OAuth env vars are set)
├── config.ts         # Env var validation
└── run.ts            # Job runner entry point
```

## Getting Started

1. Copy `.env.example` to `.env` and fill in the values
2. `npm install`
3. `npm run fetch-schema` — pulls the knowledge graph schema into `data/schema.md` and `data/schema.json`

## Understanding the Data

Before building anything, run `npm run fetch-schema`. This populates:

- **`data/schema.md`** — human-readable summary of all node types, edge types, and their relationships
- **`data/schema.json`** — full schema response from the API

Read `data/schema.md` to understand what data is available before building pages or writing jobs.

## Building Pages

This is a Next.js app using the App Router. Pages are React server components by default — they run on the server and can fetch data directly from the Azava API.

### Server components (default — use for most pages)

Server components fetch data at request time. The API key stays server-side automatically.

```typescript
// src/app/my-page/page.tsx
import { azava } from "@/lib/azava";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  const nodes = await azava.nodes({ type: "company", limit: 20 });
  return (
    <div>
      {nodes.map((n: any) => (
        <div key={n.id}>{n.label}</div>
      ))}
    </div>
  );
}
```

### API routes (for client-side interactivity)

When you need client-side fetching (search-as-you-type, infinite scroll, etc.), create an API route:

```typescript
// src/app/api/search/route.ts
import { azava } from "@/lib/azava";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const results = await azava.nodes({ search: searchParams.get("q") ?? "" });
  return Response.json(results);
}
```

Then fetch from a client component:

```typescript
"use client";
const results = await fetch(`/api/search?q=${query}`).then(r => r.json());
```

### Workflow for adding a new page

1. Read `data/schema.md` to understand what node types, edge types, and properties exist
2. Create a new directory under `src/app/` with a `page.tsx` file
3. Fetch data using `azava` in a server component, or create an API route for client-side needs
4. Test locally with `npm run dev`

## Azava API Client

`src/lib/azava.ts` is the typed client used by pages and jobs. It is **server-side only** — never import it in a `"use client"` component.

### Reading data

```typescript
import { azava } from "@/lib/azava";

const schema = await azava.schema();
const nodes = await azava.nodes({ type: "company", search: "acme", limit: 20 });
const node = await azava.node("node-id");
const edges = await azava.edges("node-id");
// Cypher with parameterised values (use $paramName — never interpolate user input)
const results = await azava.cypher(
  "MATCH (n:Company) WHERE n.stage = $stage RETURN n",
  { params: { stage: "Series A" }, limit: 50 },
);
```

### Writing data (for jobs)

```typescript
import { azava } from "@/lib/azava";

await azava.ingest({
  title: "Deal: Acme Corp Series A",
  content: "Full message body...",
  contentType: "DEALFLOW",
});

const attachment = await azava.uploadDocument(blob, { filename: "memo.pdf", contentType: "application/pdf" });
await azava.ingest({ title: "Memo", attachments: [attachment] });
```

## Adding a Cron Job

1. Create `src/jobs/my-job.ts` with a default export async function
2. Add a cron entry to `render.yaml`
3. Test locally: `npm run job my-job`

## Authentication: Login with Azava

Auth is for **internal team tools only** — dashboards, admin panels, tools where you need to know which team member is making requests. If the tool is a public view over data (shared reports, embeds, public dashboards), do NOT add auth.

### When to use auth

- The tool is for a specific team's internal use
- You need to identify which user is making requests
- You want to restrict access to team members only

### When NOT to use auth

- The tool is a public-facing view anyone should be able to see
- There's no reason to know who the user is
- The tool is a simple data display with no user-specific behavior

### How it works

Auth is controlled entirely by environment variables. If `AZAVA_OAUTH_CLIENT_ID`, `AZAVA_OAUTH_CLIENT_SECRET`, and `SESSION_SECRET` are set, the middleware in `src/middleware.ts` gates all routes — users must log in via Azava before accessing any page. If these env vars are not set, the middleware does nothing and the app is fully public.

No code changes are needed to enable or disable auth — just set or remove the env vars.

### Accessing user identity in pages

```typescript
import { getUser } from "@/lib/auth";

export default async function MyPage() {
  const user = await getUser(); // { userId, teamId } or null
  // ...
}
```

### Registering an OAuth client

Before auth works, the tool must be registered with the Azava platform. This is a one-time step per deployment:

```bash
npm run register https://my-tool.onrender.com
```

This prints `AZAVA_OAUTH_CLIENT_ID` and `AZAVA_OAUTH_CLIENT_SECRET` — add them to your deployment's environment along with a `SESSION_SECRET`.

### Environment variables for auth

```
AZAVA_OAUTH_CLIENT_ID=       # from: npm run register <url>
AZAVA_OAUTH_CLIENT_SECRET=   # from: npm run register <url>
SESSION_SECRET=              # stable random string for signing session cookies
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run job <name>` | Run a job locally |
| `npm run fetch-schema` | Pull live schema into `data/` |
| `npm run register <url>` | Register OAuth client for a deployment |

## Deploying

This repo deploys to Render via `render.yaml`. Push to main to deploy.

- Cron jobs and the dashboard share the same env var group (`azava`)
- Set env vars in the Render dashboard under the `azava` env group
- If using auth, add the OAuth and session secret vars to the env group
