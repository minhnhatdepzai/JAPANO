import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loginHref } from "@/lib/storefront-access";

const DEFAULT_ORIGIN = "https://rd-system.tail6502ce.ts.net:4101";

function apiOrigin() {
  return String(process.env.JAPANO_API_ORIGIN || DEFAULT_ORIGIN).replace(/\/$/, "");
}

export async function requireStorefrontSession(nextPath: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("japano_session")?.value;
  if (!token) redirect(loginHref(nextPath));

  let response: Response;
  try {
    response = await fetch(`${apiOrigin()}/api/auth/me`, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        ...(process.env.CF_ACCESS_CLIENT_ID ? { "CF-Access-Client-Id": process.env.CF_ACCESS_CLIENT_ID } : {}),
        ...(process.env.CF_ACCESS_CLIENT_SECRET ? { "CF-Access-Client-Secret": process.env.CF_ACCESS_CLIENT_SECRET } : {}),
      },
    });
  } catch {
    redirect(loginHref(nextPath));
  }
  if (!response.ok) redirect(loginHref(nextPath));
}
