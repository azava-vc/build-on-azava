# build-on-azava

Build dashboards, jobs, and internal tools on top of your Azava workspace.

## Setup

```bash
cp .env.example .env
# Add your AZAVA_API_URL and AZAVA_API_KEY (generate one at https://app.azava.com/settings/api-keys)

npm install
npm run fetch-schema
npm run dev
```

Open [localhost:3000](http://localhost:3000) to see the dashboard.

## What you can build

- **Dashboards** — pages that display and explore your workspace data
- **Jobs** — scheduled tasks that pull data from external sources into Azava
- **Internal tools** — team-only apps with "Login with Azava" authentication

## Adding auth (optional)

If your tool is for internal team use, you can restrict access to your Azava team members:

```bash
npm run register https://your-deployed-url.com
```

Add the printed values (`AZAVA_OAUTH_CLIENT_ID`, `AZAVA_OAUTH_CLIENT_SECRET`) and a `SESSION_SECRET` to your deployment environment. Auth activates automatically — no code changes needed.

## Deploying

Push to main to deploy via the included `render.yaml`. Set your env vars in the Render dashboard under the `azava` env group.

## Working with an agent

Point your coding agent at this repo and describe what you want to build. The `CLAUDE.md` file contains everything it needs to understand the architecture, add pages, create jobs, and wire up auth.

Run `npm run fetch-schema` first so the agent can see what data is available in your workspace.
