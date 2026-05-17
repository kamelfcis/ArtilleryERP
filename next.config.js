/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // Disable the service worker in development to keep hot-reload working.
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    // Supabase REST API — network-first with a 5 s timeout so the app
    // stays responsive when offline and falls back to cached data.
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/rest\//,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'supabase-rest',
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 24 * 60 * 60, // 24 h
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    // Supabase auth endpoints — network-only (never cache tokens).
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/auth\//,
      handler: 'NetworkOnly',
    },
    // Next.js static assets — stale-while-revalidate for fast loads.
    {
      urlPattern: /^\/_next\/static\//,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-static',
      },
    },
    // Images — cache-first with a 30-day expiry.
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
  ],
})

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  experimental: {
    // puppeteer-core and chromium-min use private class fields (#field) in their
    // ESM builds which Next.js 14's webpack cannot parse. Mark them as external so
    // webpack skips bundling them and Node.js loads them directly at runtime.
    serverComponentsExternalPackages: ['puppeteer-core', '@sparticuz/chromium-min'],
  },
}

module.exports = withPWA(nextConfig)
