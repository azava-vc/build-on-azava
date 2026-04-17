# build-on-azava

Build dashboards, jobs, and internal tools on top of your Azava workspace.

## Getting started

Create your own project from this template:

```bash
# 1. Create a new private repo on GitHub, then:
git clone https://github.com/azava-vc/build-on-azava.git my-tool
cd my-tool
git remote set-url origin git@github.com:YOUR_ORG/my-tool.git
git push -u origin main
```

Then set up your environment:

```bash
cp .env.example .env
# Add your AZAVA_API_URL and AZAVA_API_KEY (generate one at https://app.azava.com/settings/api-keys)

npm install
npm run fetch-schema
npm run dev
```

To pull in future framework updates from build-on-azava:

```bash
git remote add upstream https://github.com/azava-vc/build-on-azava.git
git fetch upstream
git merge upstream/main
```

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

Push to main to deploy via the included `render.yaml`.

1. In Render, create a new **Blueprint** and connect your repo
2. Set env vars in the Render dashboard under the `azava` env group — **never commit secrets to `render.yaml` or the repo**
3. If using auth, run `npm run register <your-deployed-url>` and add the printed OAuth credentials to the env group

## Working with an agent

Point your coding agent at this repo and describe what you want to build. The `CLAUDE.md` file contains everything it needs to understand the architecture, add pages, create jobs, and wire up auth.

Run `npm run fetch-schema` first so the agent can see what data is available in your workspace.
