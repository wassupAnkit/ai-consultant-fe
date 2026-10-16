"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { track } from "@/lib/analytics";
import { DESTINATIONS } from "@/lib/constants";
import { EdgeApiError, searchKnowledge } from "@/lib/edge/api";
import type { KnowledgeResult } from "@/lib/edge/types";
import { cn } from "@/lib/utils";
import { SourceCard } from "./source-card";

/** Direct retrieval over the knowledge base; no model call, so results are instant and unfiltered by an answer. */
export function KnowledgeSearch() {
  const { setDraft } = useChat();
  const [query, setQuery] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [results, setResults] = useState<KnowledgeResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    abortRef.current?.abort();
    if (q.length < 2) {
      setResults(null);
      setLoading(false);
      setError(null);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await searchKnowledge({ query: q, k: 8, countries: countries.length ? countries : undefined }, controller.signal);
        if (controller.signal.aborted) return;
        setResults(res.results);
        track("knowledge_search", { query: q, countries, results: res.results.length });
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof EdgeApiError ? err.message : "Search failed. Please try again.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, countries]);

  const toggleCountry = (slug: string) => setCountries((c) => (c.includes(slug) ? c.filter((x) => x !== slug) : [...c, slug]));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 p-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the knowledge base…"
            aria-label="Search the knowledge base"
            className="h-9 w-full rounded-md border border-border bg-card pl-8 pr-8 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by destination">
          {DESTINATIONS.map((d) => {
            const on = countries.includes(d.slug);
            return (
              <button
                key={d.slug}
                type="button"
                onClick={() => toggleCountry(d.slug)}
                aria-pressed={on}
                title={d.label}
                className={cn(
                  "h-6 rounded-full border px-2 text-[11px] font-medium transition focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                  on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                )}
              >
                {d.short}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {loading && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Searching…
          </p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
        {!loading && !error && results === null && (
          <p className="text-xs leading-relaxed text-muted-foreground">Type at least two characters. Results come straight from the indexed pages (vector + keyword match), ranked by relevance. Filter by destination with the chips above.</p>
        )}
        {!loading && !error && results !== null && results.length === 0 && <p className="text-xs text-muted-foreground">No matching excerpts. Try different wording or remove the destination filter.</p>}
        {results && results.length > 0 && (
          <ul className="space-y-2">
            {results.map((r) => (
              <SourceCard
                key={r.id}
                title={r.title}
                url={r.url}
                section={r.section}
                excerpt={r.excerpt}
                country={r.country}
                docType={r.docType}
                source={r.source}
                sourceKind={(r as KnowledgeResult & { sourceKind?: string | null }).sourceKind}
                onAsk={() => setDraft(`Using the page "${r.title}"${r.section ? ` (${r.section})` : ""}, `)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
