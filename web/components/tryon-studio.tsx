"use client";

import { Camera, Check, Download, Film, ImagePlus, LoaderCircle, Play, RefreshCw, ShieldCheck, Sparkles, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, postJson, runAiJob } from "@/lib/client-api";
import { formatCurrency, productImage } from "@/lib/format";
import { sellableVariants, uniqueSizes } from "@/lib/product";
import type { Product } from "@/lib/types";

type BodyResult = {
  ok: boolean;
  measurementStatus?: "estimated" | "partial" | "insufficient_evidence";
  measurementMessage?: string;
  estimatedHeight?: { minCm?: number | null; maxCm?: number | null; confidence?: number };
  estimatedWeight?: { minKg?: number | null; maxKg?: number | null; confidence?: number };
  estimatedGirthRanges?: Record<string, { minCm?: number | null; maxCm?: number | null }>;
  recommendedSize?: string;
  sizeAdvice?: string;
  imageFingerprint?: string;
  poseCache?: unknown;
  tryOnEligible?: boolean;
  warnings?: string[];
};

type TryOnResponse = {
  ok: boolean;
  imageBase64?: string;
  imageUrl?: string;
  resultUrl?: string;
  message?: string;
  recommendedSize?: string;
  engine?: string;
  durationMs?: number;
  identityWarning?: string;
  accessoryWarning?: string;
  qualityWarning?: { message?: string };
};

type MotionPreset = { id?: string; action?: string; label?: string; name?: string };

function imageValue(response: TryOnResponse) {
  const raw = String(response.imageUrl || response.resultUrl || response.imageBase64 || "");
  if (!raw) return "";
  return raw.startsWith("data:") || raw.startsWith("http") ? raw : `data:image/png;base64,${raw}`;
}

function rangeText(range: { minCm?: number | null; maxCm?: number | null } | undefined, unit = "cm") {
  return range?.minCm != null && range?.maxCm != null ? `${range.minCm}–${range.maxCm} ${unit}` : "Chưa đủ bằng chứng";
}

function weightText(range: BodyResult["estimatedWeight"]) {
  return range?.minKg != null && range?.maxKg != null ? `${range.minKg}–${range.maxKg} kg` : "Chưa đủ bằng chứng";
}

export function TryOnStudio({ products }: { products: Product[] }) {
  const searchParams = useSearchParams();
  const initialSlug = searchParams.get("product") || products[0]?.slug || "";
  const [slug, setSlug] = useState(initialSlug);
  const product = products.find((item) => item.slug === slug) || products[0];
  const variants = sellableVariants(product);
  const defaultSize = variants[0]?.size || "";
  const [size, setSize] = useState(defaultSize);
  const [photo, setPhoto] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [consent, setConsent] = useState(false);
  const [adultConsent, setAdultConsent] = useState(false);
  const [body, setBody] = useState<BodyResult | null>(null);
  const [result, setResult] = useState("");
  const [resultMeta, setResultMeta] = useState<TryOnResponse | null>(null);
  const [stage, setStage] = useState<"idle" | "analyzing" | "generating" | "motion">("idle");
  const [error, setError] = useState("");
  const [motionPresets, setMotionPresets] = useState<MotionPreset[]>([]);
  const [motion, setMotion] = useState("");
  const [video, setVideo] = useState("");
  const [jobStage, setJobStage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const isAdultGarment = useMemo(() => /bikini|swim|đồ bơi/i.test([product?.slug, product?.name, ...(product?.tags || [])].join(" ")), [product]);

  useEffect(() => {
    setSize(defaultSize);
    setResult(""); setVideo(""); setBody(null); setError("");
  }, [product?.slug, defaultSize]);

  useEffect(() => {
    api<{ presets?: MotionPreset[] }>("/api/tryon/motion/presets", { timeoutMs: 8_000 }).then((data) => {
      const presets = data.presets || [];
      setMotionPresets(presets);
      setMotion(String(presets[0]?.id || presets[0]?.action || ""));
    }).catch(() => undefined);
  }, []);

  const loadPhoto = (file?: File) => {
    if (!file) return;
    if (!/^image\/(?:jpeg|png|webp)$/.test(file.type)) return setError("Hãy dùng ảnh JPG, PNG hoặc WebP.");
    if (file.size > 12 * 1024 * 1024) return setError("Ảnh vượt quá 12 MB. Hãy giảm kích thước rồi thử lại.");
    const reader = new FileReader();
    reader.onload = () => { setPhoto(String(reader.result)); setPhotoName(file.name); setResult(""); setVideo(""); setBody(null); setError(""); };
    reader.readAsDataURL(file);
  };

  const analyze = async () => {
    if (!photo || !product) throw new Error("Hãy chọn ảnh và sản phẩm trước.");
    setStage("analyzing"); setError("");
    const analysis = await postJson<BodyResult>("/api/stylist/body-analysis", { personImageBase64: photo, productId: product.slug, measurementMode: "photo_estimate" }, 180_000);
    setBody(analysis);
    return analysis;
  };

  const generate = async () => {
    if (!photo || !product) return setError("Hãy tải ảnh rõ người và chọn sản phẩm.");
    if (!consent) return setError("Bạn cần xác nhận quyền sử dụng ảnh này.");
    if (isAdultGarment && !adultConsent) return setError("Trang phục 18+ cần xác nhận người trong ảnh là người trưởng thành.");
    try {
      const analysis = body || await analyze().catch((analysisError) => {
        const message = analysisError instanceof Error ? analysisError.message : "Không phân tích được số đo.";
        setBody({ ok: false, measurementStatus: "insufficient_evidence", measurementMessage: message });
        return null;
      });
      // Thiếu số đo không chặn try-on: backend tự kiểm riêng ảnh có đủ điều kiện tạo ảnh hay không.
      setStage("generating");
      await postJson("/api/gpu/focus", { focus: isAdultGarment ? "swimwear" : "tryon", clientId: "japano-web" }, 8_000).catch(() => undefined);
      const response = await runAiJob<TryOnResponse>("/api/tryon/jobs", {
        clientId: "japano-web",
        personImageBase64: photo,
        productId: product.slug,
        size,
        adultConsent: isAdultGarment ? adultConsent : undefined,
        qualityMode: "balanced",
        bodyAnalysisCache: analysis?.imageFingerprint ? { ...analysis, imageFingerprint: analysis.imageFingerprint, poseCache: analysis.poseCache } : undefined,
      }, { timeoutMs: 15 * 60_000, onStage: setJobStage });
      const image = imageValue(response);
      if (!image) throw new Error(response.message || "Backend chưa trả ảnh thử đồ thật.");
      setResult(image); setResultMeta(response); setVideo("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tạo được ảnh thử đồ. Hãy thử lại.");
    } finally { setStage("idle"); }
  };

  const createMotion = async () => {
    if (!result || !motion) return;
    setStage("motion"); setError("");
    try {
      await postJson("/api/gpu/focus", { focus: "motion", clientId: "japano-web" }, 8_000).catch(() => undefined);
      const response = await runAiJob<{ videoUrl?: string; message?: string }>("/api/tryon/motion/jobs", { imageBase64: result, motion, profile: "fast", clientId: "japano-web" }, { timeoutMs: 15 * 60_000, onStage: setJobStage });
      if (!response.videoUrl) throw new Error(response.message || "Backend chưa trả video.");
      setVideo(response.videoUrl);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không tạo được chuyển động."); }
    finally { setStage("idle"); }
  };

  const busy = stage !== "idle";
  return <div className="tryon-studio">
    <aside className="tryon-controls">
      <div className="step"><span>01</span><div><h2>Chọn thiết kế</h2><p>Catalog và tồn kho dùng chung với app.</p></div></div>
      <label className="field-label" htmlFor="tryon-product">Sản phẩm</label><select id="tryon-product" value={product?.slug || ""} onChange={(event) => setSlug(event.target.value)}>{products.map((item) => <option value={item.slug} key={item.slug}>{item.name} · {formatCurrency(item.price)}</option>)}</select>
      {product && <div className="selected-product"><img src={productImage(product)} width="72" height="90" alt="" /><div><strong>{product.name}</strong><span>{product.kanji}</span></div></div>}
      <fieldset className="compact-sizes"><legend>Size muốn thử</legend>{uniqueSizes(variants).map((value) => <button key={value} aria-pressed={size === value} className={size === value ? "active" : ""} onClick={() => setSize(value)}>{value}</button>)}</fieldset>

      <div className="step"><span>02</span><div><h2>Ảnh của bạn</h2><p>Đứng rõ người, đủ sáng; không cần nhập số đo để thử đồ.</p></div></div>
      <input ref={fileRef} className="sr-only" type="file" aria-label="Chọn ảnh của bạn để thử đồ" accept="image/jpeg,image/png,image/webp" onChange={(event) => loadPhoto(event.target.files?.[0])} />
      <button className="upload-zone" onClick={() => fileRef.current?.click()}><ImagePlus aria-hidden="true" /><strong>{photo ? "Đổi ảnh" : "Chọn ảnh từ máy"}</strong><span>{photoName || "JPG, PNG, WebP · tối đa 12 MB"}</span></button>
      <label className="consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span><strong>Tôi có quyền sử dụng ảnh này.</strong> Ảnh chỉ dùng để tạo kết quả trong phiên hiện tại.</span></label>
      {isAdultGarment && <label className="consent adult"><input type="checkbox" checked={adultConsent} onChange={(event) => setAdultConsent(event.target.checked)} /><span><strong>Tôi xác nhận người trong ảnh từ 18 tuổi.</strong> Backend vẫn kiểm tra độ tuổi và độ che phủ; xác nhận này không tắt safety.</span></label>}
      <button className="button primary full" disabled={busy || !photo || !consent} onClick={generate}>{busy ? <><LoaderCircle className="spin" aria-hidden="true" />{stage === "analyzing" ? "Đang phân tích bằng chứng…" : stage === "generating" ? "AI đang mặc sản phẩm…" : "Đang tạo chuyển động…"}</> : <><Sparkles aria-hidden="true" />Phân tích & thử ngay</>}</button>
      <p className="timing-note">Ảnh thử đồ thường mất khoảng 40–80 giây. Chúng tôi chỉ hiển thị bước đang chạy thật, không chạy thanh phần trăm giả.</p>
    </aside>

    <section className="tryon-workspace" aria-live="polite">
      <div className="tryon-canvas">{result ? <img src={result} width="1024" height="1365" alt={`Kết quả thử ${product?.name}`} /> : photo ? <img src={photo} width="1024" height="1365" alt="Ảnh bạn đã chọn" /> : <div className="tryon-placeholder"><Camera aria-hidden="true" /><span>Ảnh của bạn sẽ xuất hiện tại đây</span><small>Chỉ ảnh bạn chọn được dùng, trong đúng phiên này</small></div>}{busy && <div className="processing-overlay"><LoaderCircle className="spin" aria-hidden="true" /><strong>{jobStage || (stage === "analyzing" ? "Đang đánh giá ảnh & bằng chứng" : stage === "generating" ? "Đang tạo ảnh thử đồ thật" : "Đang tạo MP4 H.264")}</strong><span>Đừng đóng trang trong khi GPU đang xử lý.</span></div>}</div>
      {body && <div className="body-evidence"><header><div><span className="eyebrow">Phân tích bằng chứng</span><h2>{body.measurementStatus === "insufficient_evidence" ? "Chưa đủ dữ liệu để đo" : "Khoảng ước lượng từ ảnh"}</h2></div><span className={`evidence-status ${body.measurementStatus || "partial"}`}>{body.measurementStatus === "estimated" ? "Ước lượng" : body.measurementStatus === "partial" ? "Một phần" : "Thiếu bằng chứng"}</span></header><div className="measure-grid"><div><span>Chiều cao</span><strong>{rangeText(body.estimatedHeight)}</strong></div><div><span>Cân nặng</span><strong>{weightText(body.estimatedWeight)}</strong></div><div><span>Vòng ngực</span><strong>{rangeText(body.estimatedGirthRanges?.bust || body.estimatedGirthRanges?.chest)}</strong></div><div><span>Vòng eo</span><strong>{rangeText(body.estimatedGirthRanges?.waist)}</strong></div><div><span>Vòng hông</span><strong>{rangeText(body.estimatedGirthRanges?.hip)}</strong></div><div><span>Size gợi ý</span><strong>{body.recommendedSize || "Chưa đủ dữ liệu"}</strong></div></div><p>{body.measurementMessage || body.sizeAdvice || "Số đo người dùng nhập thủ công luôn được ưu tiên hơn ước lượng ảnh."}</p></div>}
      {result && <div className="result-actions"><div><span className="eyebrow"><Check aria-hidden="true" /> Kết quả AI thật</span><h2>{resultMeta?.message || "Đã tạo ảnh thử đồ"}</h2>{resultMeta?.durationMs && <p>Backend xử lý trong {(resultMeta.durationMs / 1000).toFixed(1)} giây · {resultMeta.engine}</p>}{(resultMeta?.identityWarning || resultMeta?.accessoryWarning) && <p className="warning">{resultMeta.identityWarning || resultMeta.accessoryWarning}</p>}</div><div className="button-row"><a className="button secondary" href={result} download={`japano-${product?.slug || "tryon"}.png`}><Download aria-hidden="true" />Lưu ảnh</a><button className="button secondary" onClick={() => { setResult(""); setVideo(""); }}><RefreshCw aria-hidden="true" />Thử lại</button></div></div>}
      {result && <div className="motion-maker"><div><Film aria-hidden="true" /><div><span className="eyebrow">Motion Studio</span><h2>Cho kết quả chuyển động</h2><p>Profile nhanh vẫn giữ cổng chất lượng và MP4 tương thích Android.</p></div></div><label>Chuyển động<select value={motion} onChange={(event) => setMotion(event.target.value)}>{motionPresets.map((preset, index) => <option key={preset.id || preset.action || index} value={preset.id || preset.action}>{preset.label || preset.name || preset.action || `Chuyển động ${index + 1}`}</option>)}</select></label><button className="button primary" disabled={!motion || busy} onClick={createMotion}><Play aria-hidden="true" />Tạo video</button>{video && <video controls playsInline muted preload="metadata" src={video} aria-label="Video chuyển động không âm thanh từ kết quả thử đồ" />}</div>}
      {error && <div className="error-banner"><X aria-hidden="true" /><div><strong>Chưa hoàn tất được lượt thử</strong><p>{error}</p></div></div>}
      <div className="privacy-note"><ShieldCheck aria-hidden="true" /><p><strong>Ranh giới riêng tư.</strong> Ảnh của bạn không được lưu vào cơ sở dữ liệu, nhật ký hệ thống hay bộ nhớ đệm. Trang phục 18+ vẫn phải qua kiểm tra độ tuổi và độ che phủ trước khi có kết quả.</p></div>
    </section>
  </div>;
}
