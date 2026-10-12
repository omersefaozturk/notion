import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

export type Caption = { text: string; start: number; duration: number };

/** One caption chunk at a time, popped in with a spring, pinned to the lower third. */
export const Captions: React.FC<{ captions: Caption[] }> = ({ captions }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const active = captions.find((c) => t >= c.start && t < c.start + c.duration) ?? null;
  if (!active) return null;

  const local = frame - Math.round(active.start * fps);
  const pop = spring({ frame: local, fps, config: { damping: 200, mass: 0.5 } });
  const fadeOut = interpolate(
    t,
    [active.start + active.duration - 0.16, active.start + active.duration],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        position: "absolute",
        left: 78,
        right: 78,
        bottom: 262,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          opacity: fadeOut,
          transform: `translateY(${interpolate(pop, [0, 1], [26, 0])}px) scale(${interpolate(
            pop,
            [0, 1],
            [0.94, 1]
          )})`,
          background: "rgba(6, 10, 20, 0.78)",
          borderLeft: `7px solid ${theme.gold}`,
          borderRadius: 18,
          padding: "26px 34px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
          maxWidth: 900,
        }}
      >
        <span
          style={{
            fontFamily: theme.font,
            fontWeight: 800,
            fontSize: 62,
            lineHeight: 1.18,
            letterSpacing: -1.2,
            color: theme.ink,
            textAlign: "center",
            display: "block",
            textWrap: "balance",
          }}
        >
          {active.text}
        </span>
      </div>
    </div>
  );
};
