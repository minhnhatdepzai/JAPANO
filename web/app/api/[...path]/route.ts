import { NextRequest, NextResponse } from "next/server";
import { loginHref, requiresStorefrontSession } from "@/lib/storefront-access";

const ORIGIN = String(process.env.JAPANO_API_ORIGIN || "https://rd-system.tail6502ce.ts.net:4101").replace(/\/$/, "");
const BLOCKED_PREFIXES = ["admin", "state", "seed", "reset", "analytics", "users", "payments"];
const AUTH_ENDPOINTS = new Set(["auth/login", "auth/register", "auth/google"]);
const PUBLIC_CACHE = [
  /^storefront\/home$/,
  /^products(?:\/[^/]+)?$/,
  /^categories$/,
  /^banners$/,
  /^shop$/,
  /^policies\/fulfillment$/,
  /^japan-spots\/catalog$/,
  /^japan-spots\/scenes$/,
];

function pathFrom(parts: string[]) {
  return parts.map((part) => encodeURIComponent(decodeURIComponent(part))).join("/");
}

function forbiddenPath(path: string) {
  return BLOCKED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function csrfAllowed(request: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  return origin === request.nextUrl.origin;
}

function backendHeaders(request: NextRequest) {
  const headers = new Headers();
  const passthrough = ["accept", "content-type", "accept-language", "user-agent", "range"];
  for (const name of passthrough) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const token = request.cookies.get("japano_session")?.value;
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (process.env.CF_ACCESS_CLIENT_ID) headers.set("CF-Access-Client-Id", process.env.CF_ACCESS_CLIENT_ID);
  if (process.env.CF_ACCESS_CLIENT_SECRET) headers.set("CF-Access-Client-Secret", process.env.CF_ACCESS_CLIENT_SECRET);
  return headers;
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await context.params;
  const path = pathFrom(parts || []);
  if (!path || forbiddenPath(path)) {
    return NextResponse.json({ ok: false, message: "Route này không được công khai qua storefront." }, { status: 404 });
  }
  if (!csrfAllowed(request)) {
    return NextResponse.json({ ok: false, message: "Nguồn yêu cầu không hợp lệ. Hãy tải lại trang." }, { status: 403 });
  }

  if (path === "auth/logout" && request.method === "POST") {
    const response = NextResponse.json({ ok: true });
    response.cookies.set("japano_session", "", { path: "/", maxAge: 0, httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax" });
    return response;
  }

  // Kiểm tra trạng thái phiên là phép đọc công khai nhưng tuyệt đối không trả
  // dữ liệu cá nhân khi thiếu cookie. Trả 200 + user:null để trang catalog của
  // khách không tạo một lỗi 401 giả trong console ở mọi lần tải trang.
  if (path === "auth/me" && request.method === "GET" && !request.cookies.get("japano_session")?.value) {
    return NextResponse.json({ ok: true, authenticated: false, user: null }, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (requiresStorefrontSession(request.method, path) && !request.cookies.get("japano_session")?.value) {
    return NextResponse.json({
      ok: false,
      message: "Bạn cần đăng nhập để sử dụng tính năng này.",
      loginUrl: loginHref(request.nextUrl.pathname),
    }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const target = new URL(`${ORIGIN}/api/${path}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));
  const hasBody = !["GET", "HEAD"].includes(request.method);
  const upstream = await fetch(target, {
    method: request.method,
    headers: backendHeaders(request),
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: "manual",
    cache: "no-store",
  });

  if (path === "auth/me" && request.method === "GET" && upstream.status === 401) {
    const response = NextResponse.json({ ok: true, authenticated: false, user: null }, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
    response.cookies.set("japano_session", "", { path: "/", maxAge: 0, httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax" });
    return response;
  }

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  if (AUTH_ENDPOINTS.has(path) && contentType.includes("application/json")) {
    const data = await upstream.json() as Record<string, unknown>;
    const token = typeof data.token === "string" ? data.token : "";
    delete data.token;
    const response = NextResponse.json(data, { status: upstream.status });
    if (upstream.ok && token) {
      response.cookies.set("japano_session", token, {
        httpOnly: true,
        secure: request.nextUrl.protocol === "https:",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
    }
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const responseHeaders = new Headers();
  responseHeaders.set("content-type", contentType);
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) responseHeaders.set("content-range", contentRange);
  const acceptRanges = upstream.headers.get("accept-ranges");
  if (acceptRanges) responseHeaders.set("accept-ranges", acceptRanges);
  const location = upstream.headers.get("location");
  if (location) responseHeaders.set("location", location);
  const cacheable = request.method === "GET" && PUBLIC_CACHE.some((pattern) => pattern.test(path));
  responseHeaders.set("Cache-Control", cacheable ? "public, max-age=30, stale-while-revalidate=120" : "no-store");
  responseHeaders.set("Vary", "Accept-Encoding, Cookie");
  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
