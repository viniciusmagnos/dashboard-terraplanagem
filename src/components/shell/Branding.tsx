/**
 * Identidade visual Manta — ícone oficial (marca M/N em cobre, de
 * `public/brand/`). Usado no Header, no watermark e na tela de login.
 */

export function MantaMark({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/brand/icon-color.png"
      width={size}
      height={size}
      alt="Manta"
      draggable={false}
      className="select-none object-contain"
      style={{ width: size, height: size }}
    />
  );
}

export function MantaLogo({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <MantaMark size={size} />
      <span className="leading-tight">
        <span
          className="block font-semibold tracking-tight text-foreground"
          style={{ fontSize: size * 0.5 }}
        >
          Manta
        </span>
        <span className="block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Terraplenagem
        </span>
      </span>
    </span>
  );
}
