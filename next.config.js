/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep Preview artifacts isolated from production builds.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};
module.exports = nextConfig;
