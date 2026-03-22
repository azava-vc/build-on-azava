import { z } from "zod";
import { azava } from "../lib/azava.js";

/**
 * Named queries.
 *
 * Each query has a param schema and a run function.
 * The frontend calls GET /query/<name>?param=value
 * and the server validates params, runs the query, returns JSON.
 *
 * Add new queries here — the server picks them up automatically.
 */

function query<T extends z.ZodType>(schema: T, run: (params: z.infer<T>) => Promise<unknown>) {
  return { schema, run };
}

export const queries = {
  schema: query(z.object({}), async () => {
    return azava.schema();
  }),

  nodes: query(
    z.object({
      type: z.string().optional(),
      search: z.string().optional(),
      limit: z.coerce.number().int().positive().max(100).default(20),
      offset: z.coerce.number().int().min(0).default(0),
    }),
    async (params) => {
      return azava.nodes(params);
    },
  ),

  node: query(
    z.object({ id: z.string().min(1) }),
    async (params) => {
      return azava.node(params.id);
    },
  ),

  edges: query(
    z.object({ nodeId: z.string().min(1) }),
    async (params) => {
      return azava.edges(params.nodeId);
    },
  ),

  // -- Example: custom Cypher query with safe parameters --
  // The Cypher is defined here, not by the frontend. The frontend
  // only supplies the parameters.

  "companies-by-stage": query(
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
} as const;

export type QueryName = keyof typeof queries;
export type QueryDef = { schema: z.ZodType; run: (params: unknown) => Promise<unknown> };
