/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Admin-uploaded covers are stored as data URLs or remote links, so allow any https host.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  experimental: {
    // Keeps the JSON store out of the bundler's static analysis path.
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default nextConfig;
