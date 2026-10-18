import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          // The product asks the user to open the network tab and verify that
          // nothing leaves the machine. A policy that forbade connections to
          // third parties outright would be a stronger claim, but it would also
          // break the hosted path the banner offers as a real option.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ]
  },
}

export default nextConfig

export const config = {
  // Populated at build time when SENTRY_AUTH_TOKEN is present, so source maps
  // upload. No-op otherwise, and never a build failure.
  sentry: {
    silent: !process.env.SENTRY_AUTH_TOKEN,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
  },
}