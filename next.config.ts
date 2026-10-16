const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    // API routes stream NDJSON and return per-user data: always go to the network.
    runtimeCaching: [{ urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith("/api/"), handler: "NetworkOnly" }],
  },
  extendDefaultRuntimeCaching: true,
});

/**
 * A deliberately narrow Content-Security-Policy: it restricts where images may load from and
 * nothing that Next's inline scripts, Google Identity Services (script, styles and the
 * sign-in iframe from accounts.google.com) or dev HMR depend on, so it cannot break login.
 * `img-src` is the part that matters: model answers can quote text an attacker wrote (an
 * email, a web page), and an image URL in them would otherwise be fetched on render,
 * carrying whatever the attacker got the model to put in its query string. The markdown
 * renderer already drops those images (`components/chat/markdown.tsx`); this is the second
 * line. Only the signed-in user's Google profile photo (`*.googleusercontent.com`, the ID
 * token's `picture`) is loaded from off-site. The app is never framed.
 */
const contentSecurityPolicy = [
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy }] }];
  },
  // Self-contained server for the Docker image (COPY .next/standalone).
  output: "standalone",
  eslint: {
    // Disable ESLint during builds
    ignoreDuringBuilds: true,
  },
  reactStrictMode: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ["error", "warn"],
    } : false,
  },
};

module.exports = withPWA(nextConfig);
