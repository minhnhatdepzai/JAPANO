import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Đăng nhập", robots: { index: false, follow: true } };
export default function LoginPage() { return <div className="auth-page"><div className="auth-art"><span className="auth-sun" aria-hidden="true" /><span className="vertical-type">再 会</span><div><span className="eyebrow">Welcome back · おかえり</span><h1>Trở lại<br />với JAPANO.</h1><p>Giỏ hàng khách sẽ được hợp nhất sau khi đăng nhập.</p></div></div><section className="auth-panel"><span className="eyebrow">Tài khoản</span><h2>Đăng nhập</h2><p>Phiên đăng nhập được giữ trong cookie bảo mật của trình duyệt.</p><AuthForm mode="login" /><small>Chưa có tài khoản? <Link href="/dang-ky">Đăng ký ngay</Link></small></section></div>; }
