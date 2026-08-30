export function PageHero({ eyebrow, title, copy, aside }: { eyebrow: string; title: string; copy?: string; aside?: React.ReactNode }) {
  return <header className="page-hero"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{copy && <p>{copy}</p>}</div>{aside && <div className="page-hero-aside">{aside}</div>}</header>;
}
