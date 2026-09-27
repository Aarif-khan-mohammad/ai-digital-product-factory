/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Packages that must run in the Node.js runtime (not bundled by webpack)
    serverComponentsExternalPackages: ['pg', 'pdf-lib', 'adm-zip'],
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  env: {
    APP_VERSION: '1.0.0',
  },
}

module.exports = nextConfig
