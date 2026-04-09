# ADR 007: React SSR + Vite Client Islands

**Status:** Accepted  
**Date:** 2026-04-08

## Context

vigie's dashboard must render session state from the daemon's SQLite database and push real-time terminal output to the browser. Two approaches were considered:

1. **SPA (client-side only):** Ship a static bundle; the browser fetches all state on load via REST, subscribes to WebSocket for updates. Simple to build but requires a round-trip before any content renders, and needs careful loading-state handling.

2. **SSR + client islands:** The daemon renders the initial HTML server-side (React SSR), then activates only the interactive parts in the browser (xterm.js terminal, live session status). First paint is instant; no loading spinners for static content.

A full SSR framework (Next.js, Remix) would be overkill for a local daemon with one page and no routing complexity. The daemon is a Bun process — embedding a Node-compatible React SSR renderer is straightforward with `react-dom/server`.

## Decision

The daemon renders React to HTML string server-side and serves it from the Effect HTTP handler (`dashboard.page.tsx`). Vite builds a separate `client/` bundle containing only the interactive islands (xterm terminal, WebSocket subscribers). Islands are activated via `ReactDOM.hydrate` on matching DOM nodes.

- **Static content** (session list, status badges, metadata): rendered server-side, zero client JS
- **Interactive content** (live terminal, real-time events): Vite-bundled islands, hydrated client-side
- **CSS / design tokens**: served as static assets from `dist/client/`

## Consequences

**Advantages:**
- Instant first paint: dashboard HTML is ready before any client JS executes
- No React framework dependency (Next.js, Remix, Astro) — just `react-dom/server` + Vite
- Minimal client JS: only the islands that need interactivity ship client code
- Simple deployment: everything is served by the embedded Effect HTTP server; no separate static host needed

**Trade-offs:**
- Manual island wiring: each island must be explicitly registered and hydrated (no automatic code-splitting)
- Vite build step required before serving the client bundle in production
- SSR and client code share React component code; they must be kept compatible (no browser-only APIs at module level)

**File layout:**
```
src/
  pages/             ← SSR page renderers (React → HTML string)
  islands/           ← client-side interactive components (hydrated by Vite bundle)
  client/            ← Vite entry point for client bundle
dist/
  client/            ← Vite output, served as static assets by the daemon
```

**Future implications:**
- Additional pages can follow the same pattern without adopting a full SSR framework
- If the UI grows significantly, migrating to Astro (already used for the landing page) would preserve the islands pattern with less manual wiring
