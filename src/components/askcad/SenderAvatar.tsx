/**
 * Tiny circular avatar with deterministic-color initials.
 *
 * Used in shared chats to identify who sent each message. Same pattern as
 * Linear / Manus: hash the user id (stable across reloads) into a fixed
 * palette of tailwind hues so the same person always gets the same color.
 */

interface SenderAvatarProps {
  userId: number | null | undefined;
  name: string;
  size?: number;
  className?: string;
}

const PALETTE = [
  "bg-emerald-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-cyan-500",
  "bg-fuchsia-500",
  "bg-orange-500",
  "bg-teal-500",
  "bg-indigo-500",
] as const;

function paletteColor(seed: number | null | undefined): string {
  if (seed == null || !Number.isFinite(seed)) return "bg-zinc-500";
  // Multiply by golden ratio to spread sequential ids across the palette
  // (otherwise users 1,2,3 all land in the first three buckets).
  const idx = Math.abs(Math.floor(seed * 2654435761)) % PALETTE.length;
  return PALETTE[idx];
}

function initialsFromName(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function SenderAvatar({ userId, name, size = 24, className = "" }: SenderAvatarProps) {
  const initials = initialsFromName(name);
  const bg = paletteColor(userId);
  const px = `${size}px`;
  const fontSize = `${Math.max(10, Math.floor(size * 0.42))}px`;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-white font-medium select-none ${bg} ${className}`}
      style={{ width: px, height: px, fontSize, lineHeight: 1 }}
      aria-label={name}
      title={name}
    >
      {initials}
    </span>
  );
}
