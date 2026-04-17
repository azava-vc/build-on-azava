/**
 * One-time OAuth client registration.
 *
 * Usage: npm run register https://my-tool.onrender.com
 *
 * Registers with the Azava platform using your AZAVA_API_KEY,
 * then prints AZAVA_OAUTH_CLIENT_ID and AZAVA_OAUTH_CLIENT_SECRET
 * for you to add to your deployment's environment.
 */

import { config } from "../config";

const deploymentUrl = process.argv[2];

if (!deploymentUrl) {
  console.error("Usage: npm run register <deployment-url>");
  console.error("Example: npm run register https://my-tool.onrender.com");
  process.exit(1);
}

// Normalize: strip trailing slash, append /auth/callback
const baseUrl = deploymentUrl.replace(/\/$/, "");
const redirectUri = `${baseUrl}/auth/callback`;

console.log(`Registering OAuth client...`);
console.log(`  Platform: ${config.AZAVA_APP_URL}`);
console.log(`  Redirect URI: ${redirectUri}`);
console.log();

const res = await fetch(`${config.AZAVA_APP_URL}/oauth/cs/register`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.AZAVA_API_KEY}`,
  },
  body: JSON.stringify({
    redirect_uris: [redirectUri],
  }),
});

if (!res.ok) {
  const body = await res.text();
  console.error(`Registration failed (${res.status}): ${body}`);
  process.exit(1);
}

const { client_id, client_secret } = (await res.json()) as {
  client_id: string;
  client_secret: string;
};

console.log("Registration complete. Add these to your deployment environment:\n");
console.log(`  AZAVA_OAUTH_CLIENT_ID=${client_id}`);
console.log(`  AZAVA_OAUTH_CLIENT_SECRET=${client_secret}`);
console.log(`  SESSION_SECRET=<generate a random string, e.g.: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">`);
console.log();
console.log(`Redirect URI locked to: ${redirectUri}`);
