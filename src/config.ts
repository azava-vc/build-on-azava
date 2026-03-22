import { z } from "zod";

const schema = z.object({
  AZAVA_API_URL: z.string().url(),
  AZAVA_API_KEY: z.string().min(1),
  NOTIFY_WEBHOOK_URL: z.string().url().optional(),
});

export const config = schema.parse(process.env);
