import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

export type Caption = { text: string; start: number; duration: number };

/** One caption at a time in the band under the window. */
export const Captions: React.FC<{ captions: Caption[] }> = ({ captions }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const active = captions.find((c) => t >= c.start && t < c.start + c.duration);
  if (!active) return null;

  const local = frame - Math.round(active.start * fps);
  const pop = spring({ frame: local, fps, config: { damping: 200, mass: 0.4 } });
  const fade = interpolate(t, [active.start + active.duration - 0.14, active.start + active.duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 996,
        display: "flex",
        justifyContent: "center",
        opacity: fade,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          transform: `translateY(${interpolate(pop, [0, 1], [14, 0])}px)`,
        }}
      >
        <span style={{ width: 6, height: 38, borderRadius: 999, background: theme.ring }} />
        <span
          style={{
            fontFamily: theme.font,
            fontWeight: 700,
            fontSize: 44,
            letterSpacing: -0.6,
            color: theme.ink,
            textShadow: "0 2px 18px rgba(0,0,0,0.6)",
          }}
        >
          {active.text}
        </span>
      </div>
    </div>
  );
};
