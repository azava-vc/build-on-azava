import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { queries, type QueryName, type QueryDef } from "./queries.js";

const PORT = parseInt(process.env.PORT || "3000");
const PUBLIC_DIR = new URL("public", import.meta.url).pathname;

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url!, `http://localhost:${PORT}`);

  // Named queries: GET /query/<name>?param=value
  if (url.pathname.startsWith("/query/")) {
    const name = url.pathname.slice("/query/".length);
    const queryDef = (queries as Record<string, QueryDef>)[name];

    if (!queryDef) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Unknown query: ${name}` }));
      return;
    }

    const params = Object.fromEntries(url.searchParams);
    const parsed = queryDef.schema.safeParse(params);

    if (!parsed.success) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid parameters", details: parsed.error.flatten() }));
      return;
    }

    try {
      const result = await queryDef.run(parsed.data);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error(`[query:${name}]`, err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Query failed" }));
    }
    return;
  }

  // List available queries: GET /queries
  if (url.pathname === "/queries") {
    const available = Object.keys(queries);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ queries: available }));
    return;
  }

  // Static files
  const path = url.pathname === "/" ? "/index.html" : url.pathname;
  try {
    const file = await readFile(join(PUBLIC_DIR, path));
    res.writeHead(200, { "Content-Type": MIME[extname(path)] || "text/plain" });
    res.end(file);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, () => console.log(`Dashboard running on :${PORT}`));
