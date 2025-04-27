/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['use-synth'],
  swcMinify: true,
  experimental: {
    turbo: {
      loaders: {
        '.tsx': ['tsx'],
        '.ts': ['tsx'],
      },
    },
  },
};

module.exports = nextConfig; 