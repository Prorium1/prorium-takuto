export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? "brand-light" : ""}`}>
      <span className="brand-symbol" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <div>
        <span className="brand-name">
          prorium<span>.</span>
        </span>
        <span className="brand-subtitle">INVESTOR RELATIONS</span>
      </div>
    </div>
  );
}
