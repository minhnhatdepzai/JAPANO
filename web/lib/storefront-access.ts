export type AccountCacheKind = "cart" | "wishlist";

const PUBLIC_AUTH_MUTATIONS = new Set([
  "auth/login",
  "auth/register",
  "auth/google",
  "auth/forgot-password",
  "auth/reset-password",
]);

const PRIVATE_READ_PREFIXES = [
  "auth/me",
  "addresses",
  "carts",
  "goals",
  "notifications",
  "orders",
  "returns",
  "tryon/jobs",
  "tryon/motion/jobs",
  "wishlist",
  "japan-spots/scene-photo/jobs",
];

export function safeReturnPath(value?: string | null) {
  const candidate = String(value || "").trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return "/tai-khoan";
  try {
    const parsed = new URL(candidate, "https://storefront.japano.local");
    if (parsed.origin !== "https://storefront.japano.local") return "/tai-khoan";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/tai-khoan";
  }
}

export function loginHref(nextPath?: string | null) {
  return `/dang-nhap?next=${encodeURIComponent(safeReturnPath(nextPath))}`;
}

export function accountCacheKey(kind: AccountCacheKind, userId: string) {
  return `japano-web-${kind}-v2:${encodeURIComponent(String(userId))}`;
}

export function requiresStorefrontSession(method: string, path: string) {
  const normalizedMethod = method.toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(normalizedMethod)) {
    return !PUBLIC_AUTH_MUTATIONS.has(path);
  }
  return PRIVATE_READ_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
