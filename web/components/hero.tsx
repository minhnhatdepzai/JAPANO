import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { HeroThreeScene } from "@/components/hero-three-scene";

export function Hero() {
  return <section className="hero">
    <div className="hero-paper" aria-hidden="true"><HeroThreeScene /><span className="sun" /><span className="ink-stroke one" /><span className="ink-stroke two" /><span className="seal">日</span></div>
    <div className="hero-copy">
      <span className="eyebrow">Tokyo hiện đại · Kyoto thủ công</span>
      <h1>Mặc một khoảng<br /><em>lặng của Nhật.</em></h1>
      <p>Phom dáng gọn, sắc màu trầm và những chi tiết có lý do tồn tại — được chọn cho nhịp sống Việt Nam.</p>
      <div className="hero-actions"><Link className="button primary" href="/hang-moi">Khám phá hàng mới<ArrowUpRight aria-hidden="true" /></Link><Link className="button ghost" href="/thu-do">Thử trên ảnh của bạn</Link></div>
    </div>
    <a className="scroll-cue" href="#hang-moi"><ArrowDown aria-hidden="true" /><span>Cuộn để khám phá</span></a>
    <div className="hero-note"><strong>間</strong><span>“Ma” — vẻ đẹp nằm trong khoảng thở giữa những điều hiện hữu.</span></div>
  </section>;
}
