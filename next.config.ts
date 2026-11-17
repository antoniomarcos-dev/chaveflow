import type { NextConfig } from "next";
import { getDemoOrigin } from "./src/lib/demo-config";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    const origin = getDemoOrigin();
    const formerDemoHost = "chaveflow-demo.vercel.app";
    if (!origin || new URL(origin).hostname === formerDemoHost) return [];

    return [{
      source: "/:path*",
      has: [{ type: "host", value: formerDemoHost.replaceAll(".", "\\.") }],
      destination: `${origin}/:path*`,
      permanent: false,
    }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https://*.supabase.co https://api.resend.com;",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
