"use client";

import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { api, postJson } from "@/lib/client-api";
import { loginSchema, registerSchema } from "@/lib/schemas";
import { useStore } from "@/components/store-provider";
import { safeReturnPath } from "@/lib/storefront-access";

type Values = { name?: string; email: string; password: string };
declare global { interface Window { google?: { accounts?: { id?: { initialize: (options: unknown) => void; renderButton: (element: HTMLElement, options: unknown) => void } } } } }

export function AuthForm({ mode, nextPath }: { mode: "login" | "register"; nextPath?: string }) {
  const router = useRouter();
  const { connectAccount } = useStore();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const [googleReady, setGoogleReady] = useState(false);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Values>();

  const completeLogin = async (payload: { user?: { id?: string } }) => {
    // Chỉ sau khi cookie phiên đã được BFF đặt mới nạp giỏ và wishlist của đúng
    // tài khoản. Storefront không còn duy trì giỏ khách.
    if (payload.user?.id) await connectAccount(payload.user.id);
    router.push(safeReturnPath(nextPath));
    router.refresh();
  };

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    api<{ google?: boolean }>("/api/auth/providers", { timeoutMs: 8_000 }).catch(() => ({ google: false })).then((provider) => setGoogleReady(Boolean(provider.google && clientId)));
    if (!clientId || document.getElementById("google-gsi")) return;
    const script = document.createElement("script"); script.id = "google-gsi"; script.src = "https://accounts.google.com/gsi/client"; script.async = true; script.defer = true; document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!googleReady || !window.google?.accounts?.id) return;
    const element = document.getElementById("google-signin");
    if (!element) return;
    window.google.accounts.id.initialize({ client_id: process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID, callback: async ({ credential }: { credential: string }) => {
      try { await completeLogin(await postJson<{ user?: { id?: string } }>("/api/auth/google", { idToken: credential }, 20_000)); }
      catch (error) { setServerError(error instanceof Error ? error.message : "Không đăng nhập được bằng Google."); }
    } });
    window.google.accounts.id.renderButton(element, { theme: "outline", size: "large", width: 360, text: "continue_with", locale: "vi" });
    // Google Identity chỉ được khởi tạo lại khi provider chuyển sang sẵn sàng;
    // thay đổi giỏ cục bộ không được render thêm một nút Google thứ hai.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleReady]);

  const submit = handleSubmit(async (values) => {
    setServerError("");
    const schema = mode === "login" ? loginSchema : registerSchema;
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => setError(issue.path[0] as keyof Values, { message: issue.message }));
      return;
    }
    try {
      const payload = await postJson<{ user?: { id?: string } }>(mode === "login" ? "/api/auth/login" : "/api/auth/register", parsed.data, 20_000);
      await completeLogin(payload);
    } catch (error) { setServerError(error instanceof Error ? error.message : "Chưa thể đăng nhập."); }
  });

  return <form className="auth-form" onSubmit={submit} noValidate>
    {mode === "register" && <label><span>Họ và tên</span><input type="text" autoComplete="name" placeholder="Nguyễn Minh Anh…" {...register("name")} />{errors.name && <small role="alert">{errors.name.message}</small>}</label>}
    <label><span>Email</span><input type="email" autoComplete="email" inputMode="email" spellCheck={false} placeholder="ban@example.com…" {...register("email")} />{errors.email && <small role="alert">{errors.email.message}</small>}</label>
    {/* Nút hiện/ẩn phải nằm ngoài <label>: đặt bên trong thì tên khả truy cập
        của ô nhập bị nối thành "Mật khẩu Hiện mật khẩu". */}
    <div className="field"><label htmlFor="auth-password">Mật khẩu</label><span className="password-field"><input id="auth-password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Ít nhất 8 ký tự…" {...register("password")} /><button type="button" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button></span>{errors.password && <small role="alert">{errors.password.message}</small>}</div>
    {serverError && <p className="form-error" role="alert">{serverError}</p>}
    <button className="button primary full" disabled={isSubmitting}>{isSubmitting && <LoaderCircle className="spin" aria-hidden="true" />}{mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</button>
    {googleReady && <><div className="form-divider"><span>hoặc</span></div><div id="google-signin" className="google-signin" /></>}
  </form>;
}
