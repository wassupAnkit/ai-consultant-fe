/**
 * Server-side configuration for talking to the Edge backend
 * (heubert/expert-ai-consultant). Never import this from client components.
 */
export const env = {
  /** Base URL of the Edge API, e.g. https://ai-consultant.heubertapp.com or http://localhost:3000 */
  EDGE_API_URL: (process.env.EDGE_API_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  /** Server-to-server key (backend env API_KEY). Optional when users always send a Supabase token. */
  EDGE_API_KEY: process.env.EDGE_API_KEY ?? "",
  /** Show the composer's document upload (passport / national ID). Turn on with the backend's STUDENT_DOCS_ENABLED. */
  DOCUMENT_UPLOAD_ENABLED: process.env.DOCUMENT_UPLOAD_ENABLED === "true",
};

if (!process.env.EDGE_API_URL) {
  console.warn("[edge] EDGE_API_URL is not set; defaulting to http://localhost:3000");
}
