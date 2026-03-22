import { azava } from "@/lib/azava";

/**
 * Example API route for client-side data fetching.
 *
 * Use API routes when you need interactivity that server components can't provide
 * (search-as-you-type, infinite scroll, etc.). For static data display, prefer
 * server components — they're simpler and don't need an API route.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const nodes = await azava.nodes({
    type: searchParams.get("type") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    limit: searchParams.has("limit") ? Number(searchParams.get("limit")) : 20,
    offset: searchParams.has("offset") ? Number(searchParams.get("offset")) : 0,
  });

  return Response.json(nodes);
}
