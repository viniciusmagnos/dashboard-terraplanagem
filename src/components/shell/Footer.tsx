/** Rodapé discreto. */
export function Footer() {
  return (
    <footer className="max-w-[1400px] mx-auto px-4 py-6 text-[11px] text-muted-foreground flex items-center justify-between gap-3 flex-wrap">
      <span>Manta Associados · Dashboard de Terraplenagem</span>
      <a
        href="https://hub.mantaassociados.com"
        target="_blank"
        rel="noreferrer"
        className="hover:text-foreground transition-colors"
      >
        Dados do Manta Hub ↗
      </a>
    </footer>
  );
}
