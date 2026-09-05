"use client";

import { Check, Download, ImagePlus, LoaderCircle, MapPin, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/components/store-provider";
import { api, runAiJob } from "@/lib/client-api";
import { formatCurrency, mediaUrl } from "@/lib/format";
import { loginHref } from "@/lib/storefront-access";
import type { JapanSpot, Product } from "@/lib/types";

type TravelPose = { id: string; label: string; description: string; recommended?: boolean };
type Scene = {
  id: string;
  name: string;
  thumbnailUrl: string;
  attribution?: string;
  sourceUrl?: string;
  personSlots?: Array<{ id: string; label: string }>;
  recommendedPoseId?: string;
  poseOptions?: TravelPose[];
};
type Recommendation = { product: Product & { sizes?: string[] }; recommendedSize?: string | null; fitConfidence?: string; reasons?: string[]; culturalNote?: string; photoTip?: string };

const resultImage = (data: Record<string, unknown>) => {
  const raw = String(data.imageUrl || data.imageBase64 || data.resultUrl || "");
  if (!raw) return "";
  return raw.startsWith("data:") || raw.startsWith("http") ? raw : `data:image/png;base64,${raw}`;
};

export function TravelExperience({ spot, catalog }: { spot: JapanSpot; catalog: Product[] }) {
  const { authStatus } = useStore();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const selected = useMemo(() => recommendations.find((item) => item.product.slug === selectedSlug) || recommendations[0], [recommendations, selectedSlug]);
  const product = catalog.find((item) => item.slug === selected?.product.slug) || selected?.product;
  const sizes = selected?.product.sizes?.length ? selected.product.sizes : [...new Set((product?.variants || []).filter((item) => item.stock > 0).map((item) => item.size))];
  const selectedDefaultSize = selected?.recommendedSize || sizes[0] || "";
  const [size, setSize] = useState("");
  const [sceneId, setSceneId] = useState("");
  const selectedScene = useMemo(() => scenes.find((scene) => scene.id === sceneId) || scenes[0], [scenes, sceneId]);
  const [slotId, setSlotId] = useState("");
  const [travelPoseId, setTravelPoseId] = useState("");
  const [photo, setPhoto] = useState("");
  const [consent, setConsent] = useState(false);
  const [adultConsent, setAdultConsent] = useState(false);
  const [tryon, setTryon] = useState("");
  const [finalImage, setFinalImage] = useState("");
  const [attribution, setAttribution] = useState("");
  const [stage, setStage] = useState<"loading" | "idle" | "tryon" | "scene">("loading");
  const [error, setError] = useState("");
  const [jobStage, setJobStage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isAdultGarment = /bikini|swim|đồ bơi/i.test([product?.slug, product?.name, ...(product?.tags || [])].join(" "));

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setStage("idle");
      return;
    }
    const query = new URLSearchParams({ place: spot.place, prefecture: spot.prefecture, limit: "10" });
    Promise.all([
      api<{ recommendations?: Recommendation[]; scenes?: Scene[] }>(`/api/japan-spots/recommendations?${query}`, { timeoutMs: 12_000 }),
      api<{ scenes?: Scene[] }>(`/api/japan-spots/scenes?place=${encodeURIComponent(spot.place)}&prefecture=${encodeURIComponent(spot.prefecture)}`, { timeoutMs: 8_000 }).catch(() => ({ scenes: [] })),
    ]).then(([recs, sceneData]) => {
      const nextRecs = recs.recommendations || [];
      const nextScenes = sceneData.scenes?.length ? sceneData.scenes : recs.scenes || [];
      setRecommendations(nextRecs);
      setScenes(nextScenes);
      setSelectedSlug(nextRecs[0]?.product.slug || "");
      setSceneId(nextScenes[0]?.id || "");
      setSlotId(nextScenes[0]?.personSlots?.[0]?.id || "");
      setTravelPoseId(nextScenes[0]?.recommendedPoseId || nextScenes[0]?.poseOptions?.[0]?.id || "");
      setSize(nextRecs[0]?.recommendedSize || nextRecs[0]?.product.sizes?.[0] || "");
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "Không tải được gợi ý."))
      .finally(() => setStage("idle"));
  }, [authStatus, spot.place, spot.prefecture]);

  useEffect(() => {
    setSize(selectedDefaultSize);
    setTryon(""); setFinalImage(""); setError("");
  }, [selectedSlug, selectedDefaultSize]);

  const loadPhoto = (file?: File) => {
    if (!file) return;
    if (!/^image\/(?:jpeg|png|webp)$/.test(file.type) || file.size > 12 * 1024 * 1024) return setError("Hãy dùng ảnh JPG, PNG hoặc WebP không quá 12 MB.");
    const reader = new FileReader(); reader.onload = () => { setPhoto(String(reader.result)); setTryon(""); setFinalImage(""); setError(""); }; reader.readAsDataURL(file);
  };

  const generate = async (retrySceneOnly = false) => {
    if (!photo || !product || !size) return setError("Hãy chọn ảnh, sản phẩm và size trước.");
    if (!consent) return setError("Bạn cần xác nhận quyền sử dụng ảnh.");
    if (isAdultGarment && !adultConsent) return setError("Sản phẩm 18+ cần xác nhận người trong ảnh là người trưởng thành.");
    setError("");
    let dressed = tryon;
    try {
      if (!retrySceneOnly || !dressed) {
        setStage("tryon");
        const response = await runAiJob<Record<string, unknown>>("/api/tryon/jobs", { clientId: "japano-web-travel", personImageBase64: photo, productId: product.slug, size, adultConsent: isAdultGarment ? adultConsent : undefined, qualityMode: "balanced", travelPoseId: travelPoseId || undefined }, { timeoutMs: 15 * 60_000, onStage: setJobStage });
        dressed = resultImage(response);
        if (!dressed) throw new Error(String(response.message || "Chưa tạo được ảnh thử đồ thật."));
        setTryon(dressed);
      }
      setStage("scene");
      const response = await runAiJob<Record<string, unknown>>("/api/japan-spots/scene-photo/jobs", { place: spot.place, prefecture: spot.prefecture, personImageBase64: dressed, sceneId: sceneId || undefined, slotId: slotId || undefined }, { timeoutMs: 5 * 60_000, onStage: setJobStage });
      const composed = resultImage(response);
      if (!composed) throw new Error(String(response.message || "Đã thử đồ xong nhưng chưa ghép được cảnh."));
      setFinalImage(composed);
      setAttribution(String(response.attribution || spot.sourceLabel || ""));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Chưa hoàn tất được ảnh du lịch.");
    } finally { setStage("idle"); }
  };

  if (authStatus !== "authenticated") {
    return <div className="travel-experience">
      <section className="travel-stage"><div className="travel-result"><img src={mediaUrl(spot.photoUrl)} width="1024" height="1365" alt={`Phong cảnh ${spot.place}`} /></div></section>
      <aside className="travel-controls"><span className="eyebrow"><MapPin aria-hidden="true" /> Đưa tôi tới đây</span><h2>Đăng nhập để tạo ảnh tại {spot.place}</h2><p>Khách có thể xem sản phẩm và thông tin địa điểm. Tải ảnh, thử đồ và ghép cảnh chỉ mở sau khi đăng nhập.</p><Link className="button primary full" href={loginHref(`/du-lich-nhat-ban/${spot.id}`)}>Đăng nhập để tiếp tục</Link><Link className="button secondary full" href="/san-pham">Xem sản phẩm JAPANO</Link></aside>
    </div>;
  }

  return <div className="travel-experience">
    <section className="travel-stage">
      <div className="travel-result">{finalImage ? <img src={finalImage} width="1024" height="1365" alt={`Bạn mặc ${product?.name} tại ${spot.place}`} /> : tryon ? <img src={tryon} width="1024" height="1365" alt={`Kết quả thử ${product?.name}, đang chờ ghép cảnh`} /> : photo ? <img src={photo} width="1024" height="1365" alt="Ảnh đã chọn" /> : <img src={mediaUrl(spot.photoUrl)} width="1024" height="1365" alt={`Phong cảnh ${spot.place}`} />}{stage !== "idle" && stage !== "loading" && <div className="processing-overlay"><LoaderCircle className="spin" aria-hidden="true" /><strong>{jobStage || (stage === "tryon" ? "Đang mặc sản phẩm JAPANO trước" : "Đang đặt kết quả vào góc chụp")}</strong><span>{stage === "scene" ? "Nếu bước này lỗi, ảnh thử đồ vẫn được giữ lại." : "Chất lượng và danh tính đang được kiểm tra."}</span></div>}</div>
      {finalImage && <div className="scene-caption"><Check aria-hidden="true" /><div><strong>Đã đến {spot.place}</strong><span>{attribution}</span></div><a className="button secondary" href={finalImage} download={`japano-${spot.id}.png`}><Download aria-hidden="true" />Lưu ảnh</a></div>}
      {tryon && !finalImage && <div className="retry-scene"><p><strong>Ảnh thử đồ đã được giữ lại.</strong> Bạn có thể đổi góc rồi chỉ ghép lại cảnh, không cần chạy lại GPU thử đồ.</p><button className="button secondary" disabled={stage !== "idle"} onClick={() => generate(true)}><RefreshCw aria-hidden="true" />Thử lại cảnh</button></div>}
    </section>
    <aside className="travel-controls">
      <span className="eyebrow"><MapPin aria-hidden="true" /> Đưa tôi tới đây</span><h2>{spot.place}</h2><p>{spot.photoTip || spot.where}</p>
      <div className="travel-field"><strong>1. Góc chụp phù hợp</strong><div className="scene-options">{scenes.length ? scenes.map((scene) => <button key={scene.id} className={sceneId === scene.id ? "active" : ""} aria-pressed={sceneId === scene.id} onClick={() => { setSceneId(scene.id); setSlotId(scene.personSlots?.[0]?.id || ""); setTravelPoseId(scene.recommendedPoseId || scene.poseOptions?.[0]?.id || ""); setTryon(""); setFinalImage(""); }}><img src={mediaUrl(scene.thumbnailUrl)} width="150" height="100" alt="" /><span>{scene.name}</span></button>) : <p>Địa điểm chưa có góc chụp với vùng mặt đất đã kiểm duyệt nên hệ thống sẽ không ghép bừa.</p>}</div></div>
      {selectedScene?.personSlots?.length ? <div className="travel-field"><strong>2. Vị trí đứng an toàn</strong><p className="field-note">Chỉ những vùng đã kiểm tra không phải nước, mái nhà hay bầu trời.</p><div className="size-options compact">{selectedScene.personSlots.map((slot) => <button key={slot.id} className={slotId === slot.id ? "active" : ""} aria-pressed={slotId === slot.id} onClick={() => { setSlotId(slot.id); setFinalImage(""); }}>{slot.label}</button>)}</div></div> : null}
      {selectedScene?.poseOptions?.length ? <div className="travel-field"><strong>3. Dáng chụp AI</strong><p className="field-note">FLUX.2 đổi tư thế, FASHN mặc đồ; kết quả vẫn qua cổng chất lượng trước khi ghép cảnh.</p><div className="size-options compact">{selectedScene.poseOptions.map((pose) => <button key={pose.id} title={pose.description} className={travelPoseId === pose.id ? "active" : ""} aria-pressed={travelPoseId === pose.id} onClick={() => { setTravelPoseId(pose.id); setTryon(""); setFinalImage(""); }}>{pose.label}{pose.recommended ? " · hợp cảnh" : ""}</button>)}</div></div> : null}
      <div className="travel-field"><strong>4. Ảnh của bạn</strong><input ref={inputRef} className="sr-only" type="file" aria-label="Chọn ảnh của bạn để ghép cảnh Nhật Bản" accept="image/jpeg,image/png,image/webp" onChange={(event) => loadPhoto(event.target.files?.[0])} /><button className="upload-zone compact" onClick={() => inputRef.current?.click()}><ImagePlus aria-hidden="true" />{photo ? "Đổi ảnh" : "Chọn ảnh rõ người"}</button><label className="consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>Tôi có quyền sử dụng ảnh này.</span></label>{isAdultGarment && <label className="consent adult"><input type="checkbox" checked={adultConsent} onChange={(event) => setAdultConsent(event.target.checked)} /><span>Người trong ảnh từ 18 tuổi; backend vẫn kiểm tra safety.</span></label>}</div>
      <div className="travel-field"><strong>5. Sản phẩm sẽ mặc ngay tại đây</strong><p className="field-note">Hiển thị ngay khi chọn địa điểm; chỉ lấy sản phẩm live còn tồn kho.</p><div className="travel-products">{recommendations.map((item) => <button key={item.product.slug} className={selected?.product.slug === item.product.slug ? "active" : ""} aria-pressed={selected?.product.slug === item.product.slug} onClick={() => setSelectedSlug(item.product.slug)}><img src={mediaUrl(item.product.image || "")} width="72" height="90" alt="" /><span><strong>{item.product.name}</strong><small>{formatCurrency(item.product.price)}</small><em>{item.reasons?.[0] || item.photoTip || "Hợp khung cảnh"}</em></span></button>)}</div></div>
      <div className="travel-field"><strong>6. Size</strong><div className="size-options compact">{sizes.map((value) => <button key={value} className={size === value ? "active" : ""} aria-pressed={size === value} onClick={() => setSize(value)}>{value}</button>)}</div></div>
      <button className="button primary full" disabled={stage !== "idle" || !photo || !selected || !selectedScene || !slotId || !travelPoseId} onClick={() => generate(false)}>{stage !== "idle" ? <LoaderCircle className="spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}Thử đồ & đến đây</button>
      {error && <div className="error-banner compact"><div><strong>Chưa hoàn tất</strong><p>{error}</p></div></div>}
    </aside>
  </div>;
}
