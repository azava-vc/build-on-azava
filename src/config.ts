import { z } from "zod";

const schema = z.object({
  AZAVA_API_URL: z.string().url(),
  AZAVA_API_KEY: z.string().min(1),
  AZAVA_APP_URL: z.string().url().default("https://app.azava.com"),
  BASE_URL: z.string().url().optional(),
  NOTIFY_WEBHOOK_URL: z.string().url().optional().or(z.literal("")),
});

export const config = schema.parse(process.env);
