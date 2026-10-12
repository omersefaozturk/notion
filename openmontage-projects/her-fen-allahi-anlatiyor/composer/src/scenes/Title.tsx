import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { theme } from "../theme";

export const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame, fps, config: { damping: 200, mass: 0.9 } });
  const zoom = interpolate(frame, [0, 120], [1.06, 1.0], { extrapolateRight: "clamp" });

  const rings = [0, 1, 2].map((i) => {
    const t = ((frame - i * 22) % 120) / 120;
    return { i, r: interpolate(t, [0, 1], [120, 720]), o: interpolate(t, [0, 1], [0.34, 0]) };
  });

  return (
    <AbsoluteFill>
      <Backdrop seed="title" stars={140} glow="rgba(233,185,73,0.22)" />
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        <svg width={1080} height={1920} style={{ position: "absolute" }}>
          {rings.map((r) => (
            <circle
              key={r.i}
              cx={540}
              cy={820}
              r={r.r}
              fill="none"
              stroke={theme.gold}
              strokeWidth={2}
              opacity={Math.max(0, r.o)}
            />
          ))}
          <circle cx={540} cy={820} r={14} fill={theme.goldSoft} opacity={0.9} />
        </svg>
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "column",
            gap: 10,
            paddingBottom: 120,
          }}
        >
          <span
            style={{
              fontFamily: theme.font,
              fontWeight: 600,
              fontSize: 34,
              letterSpacing: 12,
              color: "rgba(246,243,234,0.6)",
              opacity: rise,
              transform: `translateY(${interpolate(rise, [0, 1], [30, 0])}px)`,
            }}
          >
            KÂİNAT BİR KİTAPTIR
          </span>
          <span
            style={{
              fontFamily: theme.font,
              fontWeight: 900,
              fontSize: 128,
              letterSpacing: -4,
              lineHeight: 1.0,
              color: theme.ink,
              opacity: rise,
              transform: `translateY(${interpolate(rise, [0, 1], [54, 0])}px)`,
            }}
          >
            HER FEN
          </span>
          <span
            style={{
              fontFamily: theme.font,
              fontWeight: 900,
              fontSize: 84,
              letterSpacing: -2,
              lineHeight: 1.05,
              background: `linear-gradient(92deg, ${theme.gold}, ${theme.goldSoft} 55%, ${theme.gold})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              opacity: interpolate(frame, [10, 34], [0, 1], { extrapolateRight: "clamp" }),
              transform: `translateY(${interpolate(frame, [10, 40], [40, 0], {
                extrapolateRight: "clamp",
              })}px)`,
            }}
          >
            ALLAH'I ANLATIYOR
          </span>
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
