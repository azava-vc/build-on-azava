import { config } from "../config.js";

export async function notify(message: string) {
  console.log(message);

  if (!config.NOTIFY_WEBHOOK_URL) return;

  await fetch(config.NOTIFY_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  }).catch((err) => {
    console.error("Failed to send notification:", err);
  });
}
