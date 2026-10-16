/** Small date helpers for the workspace UI. */
export function relativeTime(iso: string | Date, now: Date = new Date()): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const diffMs = now.getTime() - date.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} d ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export type DayGroup = "Today" | "Yesterday" | "Earlier";

export function dayGroup(iso: string | Date, now: Date = new Date()): DayGroup {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = date.getTime();
  if (t >= startOfToday) return "Today";
  if (t >= startOfToday - 24 * 3600 * 1000) return "Yesterday";
  return "Earlier";
}

export function initialsOf(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name ?? "").trim() || (email ?? "").split("@")[0] || "?";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function formatLatency(ms: number | undefined): string | null {
  if (!ms) return null;
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}
