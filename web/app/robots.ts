import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4200";
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/tai-khoan/", "/thanh-toan"] }], sitemap: `${site}/sitemap.xml`, host: site };
}
