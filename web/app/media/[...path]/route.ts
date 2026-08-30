import { NextRequest, NextResponse } from "next/server";

const ORIGIN = String(process.env.JAPANO_API_ORIGIN || "https://rd-system.tail6502ce.ts.net:4101").replace(/\/$/, "");

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const safePath = (path || []).map((part) => encodeURIComponent(decodeURIComponent(part))).join("/");
  const accept = request.headers.get("accept") || "image/avif,image/webp,image/*,*/*";

  // Ảnh địa điểm có giấy phép mở của Wikimedia. Host đích ghi cứng ở đây và chỉ
  // phần path đến từ client — không nhận URL do client cung cấp, nếu không đây
  // sẽ là một lỗ SSRF. Giới hạn này giống hệt ràng buộc của
  // backend/lib/japanSceneBackgrounds.js.
  if (safePath.startsWith("wikimedia/")) {
    const upstream = await fetch(`https://upload.wikimedia.org/${safePath.slice("wikimedia/".length)}`, {
      headers: { accept, "user-agent": "JAPANO-Storefront/1.0 (https://japano.vn)" },
    });
    if (!upstream.ok) return NextResponse.json({ ok: false }, { status: upstream.status });
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") || "image/jpeg",
        "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  }

  if (!safePath.startsWith("assets/")) return NextResponse.json({ ok: false }, { status: 404 });
  const upstream = await fetch(`${ORIGIN}/${safePath}`, {
    headers: {
      accept,
      ...(process.env.CF_ACCESS_CLIENT_ID ? { "CF-Access-Client-Id": process.env.CF_ACCESS_CLIENT_ID } : {}),
      ...(process.env.CF_ACCESS_CLIENT_SECRET ? { "CF-Access-Client-Secret": process.env.CF_ACCESS_CLIENT_SECRET } : {}),
    },
  });
  if (!upstream.ok) return NextResponse.json({ ok: false }, { status: upstream.status });
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") || "application/octet-stream",
      "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
