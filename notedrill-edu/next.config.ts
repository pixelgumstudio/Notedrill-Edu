import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  transpilePackages: ['@notedrill/validation', '@notedrill/shared', '@notedrill/types'],
  // Enable polling so Next.js detects file changes through Docker volume mounts on Windows
  watchOptions: {
    pollIntervalMs: 1000,
  },
  webpack(config) {
    // Resolve workspace packages directly from source so symlinks are never needed.
    // __dirname is /app/notedrill-edu in Docker and the equivalent on the host —
    // ../packages always points at the workspace packages/ directory in both contexts.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@notedrill/validation': path.resolve(__dirname, '../packages/validation/src'),
      '@notedrill/shared':     path.resolve(__dirname, '../packages/shared/src'),
      '@notedrill/types':      path.resolve(__dirname, '../packages/types/src'),
    };

    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });
    return config;
  },
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
};

export default nextConfig;
