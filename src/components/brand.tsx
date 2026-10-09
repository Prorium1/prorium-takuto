import Image from "next/image";

export function Brand() {
  return (
    <div className="brand">
      <Image
        className="brand-logo"
        src="/brand/prorium-logo-horizontal.png"
        alt="Prorium"
        width={1878}
        height={732}
        unoptimized
        preload
      />
      <span className="brand-subtitle">INVESTOR RELATIONS</span>
    </div>
  );
}
