import { azava } from "../lib/azava";

export default async function exampleSync() {
  // Replace with your actual data source
  const items = [
    { title: "Example deal", body: "Acme Corp is raising a Series A..." },
    { title: "Another deal", body: "Beta Inc seeking seed funding..." },
  ];

  for (const item of items) {
    await azava.ingest({
      title: item.title,
      content: item.body,
      contentType: "DEALFLOW",
    });
  }

  console.log(`Ingested ${items.length} items`);
}
