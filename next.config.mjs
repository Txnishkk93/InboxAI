import { withReticle } from '@reticlehq/core/next';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  optimizeFonts: false,
};

export default withReticle(nextConfig);