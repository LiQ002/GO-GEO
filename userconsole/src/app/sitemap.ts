import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://geohelper.cn";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "",
    "/features",
    "/solutions/enterprise",
    "/pricing",
    "/download",
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.8,
  }));
}
