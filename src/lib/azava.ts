import { config } from "../config";

type ContentType = "DEALFLOW" | "INVESTOR_UPDATE" | "REQUEST" | "UNKNOWN" | "COMPANY_INFO";

interface Attachment {
  key: string;
  filename: string;
  documentId: string;
  size: number;
}

export interface NodeResource {
  id: string;
  type: string; // "FILE" | "LINK" | ... (future-proof as string)
  name: string | null;
  url: string | null;
  documentId: string | null;
  createdAt: string;
  startOffset: number | null;
  endOffset: number | null;
}

export interface PresignedDownload {
  url: string;
  expiresIn: number; // seconds
}

export class AzavaClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.AZAVA_API_URL;
    this.apiKey = config.AZAVA_API_KEY;
  }

  async request(path: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Azava API ${response.status}: ${path} — ${body}`);
    }

    return response.json();
  }

  /** Ingest a message into the pipeline. */
  async ingest(options: {
    title?: string;
    content?: string;
    links?: Array<{ url: string }>;
    attachments?: Attachment[];
    contentType?: ContentType;
    overrides?: Record<string, unknown> & { type?: string; id?: string; properties?: Record<string, unknown> };
  }): Promise<{ success: true; payloadId: string }> {
    return this.request("/api/v1/ingest", {
      method: "POST",
      body: JSON.stringify(options),
    });
  }

  /** Upload a document, returns an attachment object usable in ingest(). */
  async uploadDocument(
    body: Blob,
    options: { filename: string; contentType: string },
  ): Promise<Attachment> {
    return this.request("/api/v1/documents", {
      method: "POST",
      body,
      headers: {
        "Content-Type": options.contentType,
        "Content-Length": String(body.size),
        "x-filename": options.filename,
      },
    });
  }

  /** Query the knowledge graph with Cypher. Supports $paramName syntax. */
  async cypher(query: string, options?: {
    params?: Record<string, string | number | boolean | null>;
    limit?: number;
  }) {
    return this.request("/api/v1/knowledge/cypher", {
      method: "POST",
      body: JSON.stringify({ query, ...options }),
    });
  }

  /** Get the knowledge graph schema (node types, edge types). */
  async schema() {
    return this.request("/api/v1/knowledge/schema");
  }

  /** Search/list nodes. */
  async nodes(options?: { type?: string; search?: string; limit?: number; offset?: number }) {
    const params = new URLSearchParams();
    if (options?.type) params.set("type", options.type);
    if (options?.search) params.set("search", options.search);
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.offset) params.set("offset", String(options.offset));
    const qs = params.toString();
    return this.request(`/api/v1/knowledge/nodes${qs ? `?${qs}` : ""}`);
  }

  /** Get a specific node and its properties. */
  async node(id: string) {
    return this.request(`/api/v1/knowledge/nodes/${encodeURIComponent(id)}`);
  }

  /** Get edges for a node. */
  async edges(nodeId: string) {
    return this.request(`/api/v1/knowledge/nodes/${encodeURIComponent(nodeId)}/edges`);
  }

  /**
   * List resources (files, links) linked to a node via `node_resource`.
   * FILE resources carry a `documentId` that can be passed to
   * `documentDownloadUrl()` or `documentDownloadStream()`.
   */
  async nodeResources(nodeId: string): Promise<{ data: NodeResource[] }> {
    return this.request(
      `/api/v1/knowledge/nodes/${encodeURIComponent(nodeId)}/resources`,
    );
  }

  /**
   * Get a short-lived presigned S3 URL for a document. Ideal for handing
   * directly to `<object>` / `<iframe>` when page lifetime is short.
   * Default expiry is 15 minutes.
   */
  async documentDownloadUrl(documentId: string): Promise<PresignedDownload> {
    return this.request(
      `/api/v1/knowledge/documents/${encodeURIComponent(documentId)}/download?presign=true`,
    );
  }

  /**
   * Stream a document's bytes directly from the API. Use for proxying through
   * the app — useful for long-lived same-origin URLs, caching, or audit
   * logging. Returns the raw `Response` so the caller can stream it along.
   */
  async documentDownloadStream(documentId: string): Promise<Response> {
    const url = `${this.baseUrl}/api/v1/knowledge/documents/${encodeURIComponent(documentId)}/download`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Azava API ${response.status}: ${url} — ${body}`);
    }
    return response;
  }
}

export const azava = new AzavaClient();
