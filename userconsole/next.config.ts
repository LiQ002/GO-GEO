import type { NextConfig } from "next";

// admin 后端提供 /uploads 静态资源服务（站点图标、渠道图标等）。
const adminApiUrl = (
  process.env.KRATOS_ADMIN_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: `${adminApiUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
