/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Allow Railway backend URL
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.railway.app',
      },
    ],
  },
  // Environment variables available at runtime
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
}

module.exports = nextConfig
