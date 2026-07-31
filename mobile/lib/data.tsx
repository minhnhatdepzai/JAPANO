import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { BUNDLED, setCatalog, Product } from './catalog';
import { getProducts, resolveApiMediaUrl } from './api';

const bundledBySlug: Record<string, Product> = Object.fromEntries(BUNDLED.map(p => [p.slug, p]));

type CatalogCtx = { products: Product[]; online: boolean; loading: boolean; refresh: () => Promise<void> };
const Ctx = createContext<CatalogCtx>({ products: BUNDLED, online: false, loading: false, refresh: async () => {} });
export const useCatalog = () => useContext(Ctx);

function normalizedRemote(remote:any[]):Product[]{
  const remoteBySlug = new Map(remote.filter(p=>p?.slug).map(p=>[String(p.slug),p]));
  const bundled = BUNDLED.map(base=>{
    const r:any=remoteBySlug.get(base.slug);
    if(!r)return base;
    remoteBySlug.delete(base.slug);
    return {
      ...base,
      ...r,
      slug:base.slug,
      name:base.name,
      cat:r.cat||r.category||base.cat,
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
  return [...bundled,...remoteOnly];
}

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>(BUNDLED);
  const [online, setOnline] = useState(false);
  const [loading,setLoading]=useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const remote = await getProducts();
      const merged=normalizedRemote(remote||[]);
      setCatalog(merged); setProducts(merged); setOnline(true);
    } catch {
      setCatalog(BUNDLED); setProducts(BUNDLED); setOnline(false);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return <Ctx.Provider value={{ products, online, loading, refresh: load }}>{children}</Ctx.Provider>;
}
