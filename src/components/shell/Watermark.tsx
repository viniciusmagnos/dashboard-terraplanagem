import { MantaMark } from "./Branding";

/** Marca d'água discreta (canto inferior direito), estilo Motiva. */
export function Watermark() {
  return (
    <div
      className="fixed bottom-4 right-4 pointer-events-none opacity-[0.04] z-0 hidden md:block"
      aria-hidden
    >
      <MantaMark size={120} />
    </div>
  );
}
