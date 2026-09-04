import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Đăng ký", robots: { index: false, follow: true } };
export default function RegisterPage() { return <div className="auth-page"><div className="auth-art indigo"><span className="auth-sun" aria-hidden="true" /><span className="vertical-type" aria-hidden="true">初 め</span><div><span className="eyebrow">First step · はじめ</span><h1>Bắt đầu<br />một tủ đồ đúng.</h1><p>Một tài khoản dùng chung cho app và website JAPANO.</p></div></div><section className="auth-panel"><span className="eyebrow">Tài khoản mới</span><h2>Đăng ký</h2><p>Dùng email thật để nhận hỗ trợ đơn hàng.</p><AuthForm mode="register" /><small>Đã có tài khoản? <Link href="/dang-nhap">Đăng nhập</Link></small></section></div>; }
