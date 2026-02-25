import type { NextConfig } from "next";
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  /* Diğer ayarlar buraya */
  // @ts-ignore
  turbopack: {},
};

export default withPWA(nextConfig);
