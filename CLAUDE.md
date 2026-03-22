# Client Services

This repo contains cron jobs and a dashboard for a client workspace, deployed to Render. It connects to Azava, a knowledge graph platform, via its API.

## Structure

```
src/
├── jobs/           # Cron jobs — each file exports a default async function
├── web/
│   ├── server.ts   # Dashboard server: static files + named query handler
│   ├── queries.ts  # Named queries — all data access is defined here
│   └── public/     # Dashboard frontend — plain HTML/JS/CSS, no framework
├── lib/
│   ├── azava.ts    # Typed Azava API client (server-side only)
│   ├── auth.ts     # OAuth "Login with Azava" — session cookies + user identity
│   └── notify.ts   # Failure notifications (Slack webhook)
├── tools/
│   ├── fetch-schema.ts  # Pulls live schema into data/
│   └── register.ts      # One-time OAuth client registration
├── config.ts       # Env var validation
└── run.ts          # Job runner entry point
```

## Getting Started

1. Copy `.env.example` to `.env` and fill in the values
2. `npm install`
3. `npm run fetch-schema` — pulls the knowledge graph schema into `data/schema.md` and `data/schema.json`

## Understanding the Data

Before building anything, run `npm run fetch-schema`. This populates:

- **`data/schema.md`** — human-readable summary of all node types, edge types, and their relationships
- **`data/schema.json`** — full schema response from the API

Read `data/schema.md` to understand what data is available before building dashboard views or writing jobs.

## Architecture: Named Queries

The dashboard does NOT have direct access to the Azava API. All data access goes through **named queries** defined in `src/web/queries.ts`.

This is a deliberate security boundary:
- The API key lives server-side only, never exposed to the browser
- The frontend can only call queries that are explicitly defined
- Cypher queries are authored server-side with safe parameterisation
- The frontend supplies parameters, the server constructs the query

### Defining queries (server-side)

Add queries in `src/web/queries.ts`:

```typescript
export const queries = {
  // Simple passthrough to a typed API method
  schema: query(z.object({}), async () => {
    return azava.schema();
  }),

  // Parameterised Cypher — use $paramName in the query, pass values in params object
  "deals-by-stage": query(
    z.object({
      stage: z.string().optional(),
      limit: z.coerce.number().int().positive().max(100).default(20),
    }),
    async (params) => {
      const cypher = params.stage
        ? `MATCH (c:Company) WHERE c.stage = $stage RETURN c ORDER BY c.created_at DESC`
        : `MATCH (c:Company) RETURN c ORDER BY c.created_at DESC`;
      return azava.cypher(cypher, {
        params: params.stage ? { stage: params.stage } : undefined,
        limit: params.limit,
      });
    },
  ),
};
```

### Calling queries (frontend)

From any HTML/JS page in `src/web/public/`:

```javascript
// GET /query/<name>?param=value
const schema = await fetch("/query/schema").then(r => r.json());
const deals = await fetch("/query/deals-by-stage?stage=Series+A&limit=10").then(r => r.json());

// List all available queries
const { queries } = await fetch("/queries").then(r => r.json());
```

### Workflow for adding a new dashboard view

1. Read `data/schema.md` to understand what node types, edge types, and properties exist
2. Add a named query in `src/web/queries.ts` that fetches the data you need
3. Create or edit an HTML page in `src/web/public/` that calls the query
4. Test locally with `npm run build && node dist/web/server.js`

## Azava API Client

`src/lib/azava.ts` is the typed client used by queries and jobs. It is server-side only.

### Reading data

```typescript
import { azava } from "../lib/azava.js";

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
import { azava } from "../lib/azava.js";

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
3. Test locally: `npm run dev my-job`

## Building Dashboard Pages

The dashboard is plain HTML/JS/CSS in `src/web/public/`. No build step, no framework.

**Important:** The frontend cannot call the Azava API directly. All data access must go through named queries in `src/web/queries.ts`. If you need data the frontend doesn't have access to, add a new named query first.

Add new pages as HTML files in `src/web/public/` and link to them from `index.html`.

## Deploying

This repo deploys to Render via `render.yaml`. Push to main to deploy.

- Cron jobs and the dashboard share the same env var group (`azava`)
- Set env vars in the Render dashboard under the `azava` env group

## Authentication: Login with Azava

Auth is for **internal team tools only** — dashboards, admin panels, tools where you need to know which team member is making requests. If the tool is a public view over data (shared reports, embeds, public dashboards), do NOT add auth.

### When to use auth

- The tool is for a specific team's internal use
- You need to identify which user is making requests (e.g. to show user-specific data or log who did what)
- You want to restrict access to team members only

### When NOT to use auth

- The tool is a public-facing view anyone should be able to see
- There's no reason to know who the user is
- The tool is a simple data display with no user-specific behavior

### How to wire up auth

1. Import and call `setupAuth` in `src/web/server.ts`:

```typescript
import { setupAuth } from "../lib/auth.js";

// After creating the server, before server.listen():
setupAuth(server);
```

2. Use `requireAuth` in query handlers to gate access:

```typescript
import { requireAuth } from "../lib/auth.js";

"my-query": query(z.object({}), async (_params, req, res) => {
  const user = requireAuth(req, res);
  if (!user) return; // already redirected to login
  // user.userId and user.teamId are now available
  return azava.cypher("...");
}),
```

3. Use `getUser` for optional identity (doesn't redirect):

```typescript
import { getUser } from "../lib/auth.js";

const user = getUser(req); // null if not logged in
```

### How auth works

- Auth provides **user identity only** (userId, teamId). It does NOT grant API access — data queries still use the workspace `AZAVA_API_KEY`.
- Users authenticate via "Login with Azava" (OAuth). They must be a member of the team associated with the tool's API key.
- Sessions are stored in signed cookies (7 days). No server-side session store needed.

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
| `npm run dev <job>` | Run a job locally |
| `npm run fetch-schema` | Pull live schema into `data/` |
| `npm run register <url>` | Register OAuth client for a deployment |
| `npm run build` | Compile TypeScript + copy static files |
