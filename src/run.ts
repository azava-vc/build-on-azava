import { notify } from "./lib/notify.js";

const jobName = process.argv[2];

if (!jobName) {
  console.error("Usage: job <name>");
  process.exit(1);
}

async function main() {
  const start = Date.now();
  console.log(`[${jobName}] starting`);

  try {
    const mod = await import(`./jobs/${jobName}.js`);
    await mod.default();
    console.log(`[${jobName}] completed in ${Date.now() - start}ms`);
  } catch (err) {
    const message = `[${jobName}] failed: ${err instanceof Error ? err.message : err}`;
    console.error(message);
    await notify(message);
    process.exit(1);
  }
}

main();
