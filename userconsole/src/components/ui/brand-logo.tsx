import Link from "next/link";

export function BrandLogo({
  compact = false,
  variant = "brand",
}: {
  compact?: boolean;
  variant?: "brand" | "glass";
}) {
  const isGlass = variant === "glass";

  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2.5 font-semibold tracking-[-0.03em] text-[#071a23]"
      aria-label="GEOHelper 首页"
    >
      <span
        className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-[11px] ${
          isGlass
            ? "bg-[linear-gradient(145deg,#388bff,#7957f6)] shadow-[0_7px_18px_rgba(75,112,238,.28)]"
            : "bg-[#071a23] shadow-[0_5px_15px_rgba(0,169,143,.22)]"
        }`}
      >
        <span
          className={`absolute h-5 w-5 rotate-45 rounded-[5px] border-2 ${isGlass ? "border-white/85" : "border-[#3bd3b2]"}`}
        />
        <span className="absolute h-2 w-2 rounded-full bg-white" />
      </span>
      {compact ? null : (
        <span className="text-[20px]">
          GEO
          <span className={isGlass ? "text-[#3478f6]" : "text-[#00a98f]"}>
            Helper
          </span>
        </span>
      )}
    </Link>
  );
}
