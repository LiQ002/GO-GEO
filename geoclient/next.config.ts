import type { NextConfig } from "next";
import path from "path";

const appMode = process.env.NEXT_PUBLIC_APP_MODE;
if (appMode && appMode !== "client" && appMode !== "operator") {
  throw new Error(`Invalid NEXT_PUBLIC_APP_MODE: ${appMode}`);
}

const nextConfig: NextConfig = {
  output: "export",
  ...(process.env.NODE_ENV === "development"
    ? { distDir: appMode === "operator" ? ".next-operator" : ".next-client" }
    : {}),
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
