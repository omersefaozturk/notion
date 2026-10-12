import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { theme } from "../theme";

/** Deep space gradient + deterministic starfield + vignette, shared by every scene. */
export const Backdrop: React.FC<{ seed?: string; stars?: number; glow?: string }> = ({
  seed = "base",
  stars = 90,
  glow = "rgba(233, 185, 73, 0.16)",
}) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 900], [0, -40]);
  const items = new Array(stars).fill(0).map((_, i) => {
    const x = random(`${seed}-x-${i}`) * 1080;
    const y = random(`${seed}-y-${i}`) * 1920;
    const r = 0.6 + random(`${seed}-r-${i}`) * 1.9;
    const phase = random(`${seed}-p-${i}`) * Math.PI * 2;
    const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(frame / 26 + phase));
    return { x, y, r, twinkle, i };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bgDeep }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 70% at 50% 8%, #121b33 0%, #0a1020 42%, ${theme.bgDeep} 100%)`,
        }}
      />
      <svg width={1080} height={1920} style={{ position: "absolute", transform: `translateY(${drift}px)` }}>
        {items.map((s) => (
          <circle key={s.i} cx={s.x} cy={s.y} r={s.r} fill="#ffffff" opacity={s.twinkle * 0.55} />
        ))}
      </svg>
      <AbsoluteFill
        style={{ background: `radial-gradient(55% 32% at 50% 34%, ${glow} 0%, rgba(0,0,0,0) 70%)` }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(78% 60% at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
