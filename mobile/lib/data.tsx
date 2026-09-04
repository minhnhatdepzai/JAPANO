import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { BUNDLED, setCatalog, Product } from './catalog';
import { getProducts, resolveApiMediaUrl } from './api';

const bundledBySlug: Record<string, Product> = Object.fromEntries(BUNDLED.map(p => [p.slug, p]));

type CatalogCtx = { products: Product[]; online: boolean; loading: boolean; refresh: () => Promise<void> };
const Ctx = createContext<CatalogCtx>({ products: BUNDLED, online: false, loading: false, refresh: async () => {} });
export const useCatalog = () => useContext(Ctx);

function normalizedRemote(remote:any[]):Product[]{
  const remoteBySlug = new Map(remote.filter(p=>p?.slug).map(p=>[String(p.slug),p]));
  // Máy chủ là nguồn sự thật. Danh mục ghi cứng chỉ còn hai việc: giữ ảnh đóng
  // gói để app dùng khi mất mạng, và làm bản dự phòng khi API không trả lời.
  //
  // Trước đây khối này lấy `name` từ bản ghi cứng và GIỮ LẠI sản phẩm mà API
  // không trả về. Hệ quả: đổi tên sản phẩm trong trang quản trị thì app vẫn
  // hiện tên cũ, và ẩn một sản phẩm đi thì nó vẫn nằm trong app — cả hai đều
  // trái với việc "app hiển thị đúng những gì có trong cơ sở dữ liệu".
  const bundled = BUNDLED.map(base=>{
    const r:any=remoteBySlug.get(base.slug);
    // API đã trả lời nhưng không có sản phẩm này ⇒ nó đã bị ẩn/nháp/xoá.
    if(!r)return null;
    remoteBySlug.delete(base.slug);
    return {
      ...base,
      ...r,
      slug:base.slug,
      name:String(r.name||r.productName||base.name),
      cat:r.cat||r.category||base.cat,
      // Loại trang phục do backend suy ra (kimono, yukata, bikini...). Thiếu
      // trường này thì hàng lọc kiểu dáng ở màn hình Sản phẩm luôn ra 0 kết quả.
      garmentType:r.garmentType||(base as any).garmentType||'',
      kanji:r.kanji||base.kanji,
      rating:Number(r.rating??r.avgRating??0),
      sold:Number(r.sold??r.unitsSold??0),
      reviewCount:Number(r.reviewCount??0),
      images:Array.isArray(r.images)&&r.images.length?r.images.map((image:any)=>resolveApiMediaUrl(typeof image==='string'?image:image?.url)):base.images,
      imageKeys:base.imageKeys,
      videos:(r.videos||[]).map((video:any)=>typeof video==='string'?resolveApiMediaUrl(video):{...video,url:resolveApiMediaUrl(video?.url)}).filter((video:any)=>typeof video==='string'?video:video?.url),
      sizes:[...new Set((r.variants||[]).map((variant:any)=>String(variant.size||'')).filter(Boolean))] as string[],
      colors:(r.variants||[]).map((variant:any)=>({name:String(variant.colorName||'Mặc định'),hex:String(variant.colorHex||r.colorHex||'#1A1410')})),
      variants:Array.isArray(r.variants)?r.variants:[],
    } as Product;
  });
  const remoteOnly=[...remoteBySlug.values()]
    .filter((p:any)=>!p.status||['published','active'].includes(String(p.status)))
    .map((p:any)=>({
      ...p,
      slug:String(p.slug),
      name:String(p.name||p.productName||p.slug),
      kanji:String(p.kanji||''),
      cat:String(p.cat||p.category||'trang-phuc'),
      garmentType:String(p.garmentType||''),
      price:Number(p.price||0),
      old:p.old??p.originalPrice??null,
      rating:Number(p.rating??p.avgRating??0),
      reviewCount:Number(p.reviewCount??0),
      sold:Number(p.sold??p.unitsSold??0),
      images:Array.isArray(p.images)&&p.images.length?p.images.map((image:any)=>resolveApiMediaUrl(typeof image==='string'?image:image?.url)):bundledBySlug[p.slug]?.images||BUNDLED[0].images,
      imageKeys:bundledBySlug[p.slug]?.imageKeys||[],
      videos:(p.videos||[]).map((video:any)=>typeof video==='string'?resolveApiMediaUrl(video):{...video,url:resolveApiMediaUrl(video?.url)}).filter((video:any)=>typeof video==='string'?video:video?.url),
      sizes:[...new Set((p.variants||[]).map((variant:any)=>String(variant.size||'')).filter(Boolean))] as string[],
      colors:(p.variants||[]).map((variant:any)=>({name:String(variant.colorName||'Mặc định'),hex:String(variant.colorHex||p.colorHex||'#1A1410')})),
      variants:Array.isArray(p.variants)?p.variants:[],
    } as Product));
  return [...bundled.filter(Boolean) as Product[],...remoteOnly];
}

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>(BUNDLED);
  const [online, setOnline] = useState(false);
  const [loading,setLoading]=useState(false);
  const lastGoodCatalog=useRef<Product[]|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const remote = await getProducts();
      if(!remote.length)throw new Error('Catalog API returned no products.');
      const merged=normalizedRemote(remote||[]);
      lastGoodCatalog.current=merged;
      setCatalog(merged); setProducts(merged); setOnline(true);
    } catch {
      // Backend/đường truyền có thể đang khởi động lại đúng lúc app mở. Không
      // được xoá catalog live đã tải thành công (kèm variant, size và tồn kho)
      // rồi thay bằng bản đóng gói thiếu tồn kho chỉ vì một request tạm lỗi.
      const fallback=lastGoodCatalog.current||BUNDLED;
      setCatalog(fallback); setProducts(fallback); setOnline(false);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(()=>{
    // Release APK trước đây chỉ tải catalog đúng một lần. Nếu backend khởi động
    // sau app, màn thử đồ giữ bản đóng gói và mất hẳn mục size cho tới khi buộc
    // dừng app. Tự thử lại khi trở về app và định kỳ chỉ trong lúc offline.
    const subscription=AppState.addEventListener('change',state=>{if(state==='active')void load();});
    return()=>subscription.remove();
  },[load]);
  useEffect(()=>{
    if(online)return;
    const retry=setInterval(()=>void load(),12_000);
    return()=>clearInterval(retry);
  },[online,load]);

  const value = useMemo(() => ({ products, online, loading, refresh: load }), [products, online, loading, load]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
