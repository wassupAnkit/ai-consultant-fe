/** Liveness/readiness probe for Kubernetes and the ALB. No auth, no dependencies. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    status: "ok",
    service: "expert-chatbot-frontend",
    timestamp: new Date().toISOString(),
  });
}
