import type { Metadata, Viewport } from "next";
import "@fontsource/be-vietnam-pro/vietnamese-400.css";
import "@fontsource/be-vietnam-pro/vietnamese-500.css";
import "@fontsource/be-vietnam-pro/vietnamese-600.css";
import "@fontsource/be-vietnam-pro/vietnamese-700.css";
import "@fontsource/shippori-mincho/latin-500.css";
import "@fontsource/shippori-mincho/latin-600.css";
import "./globals.css";
import { AiStylist } from "@/components/ai-stylist";
import { CinematicMotion } from "@/components/cinematic-motion";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StoreProvider } from "@/components/store-provider";
import { getShop } from "@/lib/server-api";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4200";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "JAPANO Shop — Thời trang Nhật Bản", template: "%s · JAPANO" },
  description: "Thời trang Nhật Bản hiện đại, thử đồ AI và trải nghiệm phong cảnh Nhật cùng JAPANO.",
  applicationName: "JAPANO Shop",
  alternates: { canonical: "/" },
  // Favicon nội tuyến: sắc nét ở mọi mật độ điểm ảnh, không tốn thêm một
  // request, và chặn hẳn cú gọi /favicon.ico trả 404 vào console.
  icons: { icon: [{ url: "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20width%3D%2232%22%20height%3D%2232%22%20fill%3D%22%23f6f1e7%22%2F%3E%3Ccircle%20cx%3D%2213%22%20cy%3D%2219%22%20r%3D%228.5%22%20fill%3D%22%23b7312c%22%2F%3E%3Cpath%20d%3D%22M7.5%2026%20L7.5%206%20L24.5%2026%20L24.5%206%22%20fill%3D%22none%22%20stroke%3D%22%23141310%22%20stroke-width%3D%222.6%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E", type: "image/svg+xml" }] },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "JAPANO Shop",
    title: "JAPANO Shop — Thời trang Nhật Bản",
    description: "Tokyo hiện đại × Kyoto thủ công — mua sắm và thử đồ AI trên cùng catalog JAPANO.",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f6f1e7", colorScheme: "light" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const shop = await getShop().catch(() => undefined);
  return <html lang="vi"><body>
    <StoreProvider>
      <CinematicMotion />
      <a className="skip-link" href="#main-content">Chuyển tới nội dung chính</a>
      <SiteHeader />
      <main id="main-content">{children}</main>
      <SiteFooter shop={shop} />
      <AiStylist />
      <div id="store-announcer" className="sr-only" aria-live="polite" />
    </StoreProvider>
  </body></html>;
}
