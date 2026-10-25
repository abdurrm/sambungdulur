import logo from '../brand/logo.json';

/** The SambungDulur mark, in the theme's Nila and Sogan (see src/brand/logo.json). */
export function Logo(props: { size?: number }) {
  const s = props.size ?? 28;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${logo.size} ${logo.size}`} aria-hidden="true" className="logo" data-testid="brand-logo">
      <g fill="none" stroke="var(--accent)" strokeWidth={logo.stroke} strokeLinecap="round" strokeLinejoin="round">
        {logo.branches.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      {logo.nodes.map((n) => (
        <circle key={n.cx} cx={n.cx} cy={n.cy} r={n.r} fill={n.tone === 'accent' ? 'var(--sogan)' : 'var(--accent)'} />
      ))}
    </svg>
  );
}
