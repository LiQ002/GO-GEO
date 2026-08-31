import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://geohelper.cn";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/console/", "/login", "/forgot-password"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
