import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Đăng nhập", robots: { index: false, follow: true } };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) { const { next } = await searchParams; const registerHref = next ? `/dang-ky?next=${encodeURIComponent(next)}` : "/dang-ky"; return <div className="auth-page"><div className="auth-art"><span className="auth-sun" aria-hidden="true" /><span className="vertical-type" aria-hidden="true">再 会</span><div><span className="eyebrow">Welcome back · おかえり</span><h1>Trở lại<br />với JAPANO.</h1><p>Đăng nhập để dùng giỏ hàng, yêu thích, thử đồ AI và các tính năng cá nhân.</p></div></div><section className="auth-panel"><span className="eyebrow">Tài khoản</span><h2>Đăng nhập</h2><p>Phiên đăng nhập được giữ trong cookie bảo mật của trình duyệt.</p><AuthForm mode="login" nextPath={next} /><small>Chưa có tài khoản? <Link href={registerHref}>Đăng ký ngay</Link></small></section></div>; }
