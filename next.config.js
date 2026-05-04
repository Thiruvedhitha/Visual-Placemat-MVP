/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable filesystem cache on Windows to avoid ENOENT rename errors
  // when multiple processes hold locks on .next/cache/webpack files.
  webpack: (config, { dev }) => {
    if (dev && process.platform === "win32") {
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
