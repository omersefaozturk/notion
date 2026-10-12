import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { theme } from "../theme";

const FENLER = ["KİMYA", "TIP", "ZİRAAT", "FİZİK", "ASTRONOMİ", "BİYOLOJİ"];

export const ClosingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const converge = interpolate(frame, [0, 70], [1, 0], { extrapolateRight: "clamp" });
  const final = spring({ frame: frame - 60, fps, config: { damping: 200, mass: 0.9 } });
  const rings = [0, 1, 2, 3].map((i) => {
    const t = ((frame - i * 18) % 110) / 110;
    return { i, r: interpolate(t, [0, 1], [80, 620]), o: interpolate(t, [0, 1], [0.3, 0]) };
  });
  const out = interpolate(frame, [durationInFrames - 20, durationInFrames], [1, 0.0], {
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Backdrop seed="closing" stars={180} glow="rgba(233,185,73,0.24)" />
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        {rings.map((r) => (
          <circle key={r.i} cx={540} cy={760} r={r.r} fill="none" stroke={theme.gold} strokeWidth={2} opacity={Math.max(0, r.o)} />
        ))}
        <circle cx={540} cy={760} r={26} fill={theme.goldSoft} opacity={0.95} />
      </svg>

      {/* the sciences converging to one centre */}
      {FENLER.map((f, i) => {
        const a = (i / FENLER.length) * Math.PI * 2 - Math.PI / 2;
        const r = 430 * converge;
        return (
          <span
            key={f}
            style={{
              position: "absolute",
              left: 540 + r * Math.cos(a) - 110,
              top: 760 + r * Math.sin(a) - 24,
              width: 220,
              textAlign: "center",
              fontFamily: theme.font,
              fontWeight: 800,
              fontSize: 34,
              letterSpacing: 2,
              color: theme.ink,
              opacity: Math.min(1, converge * 1.6),
            }}
          >
            {f}
          </span>
        );
      })}

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          paddingTop: 420,
          gap: 22,
        }}
      >
        <span
          style={{
            fontFamily: theme.font,
            fontWeight: 600,
            fontSize: 38,
            letterSpacing: 8,
            color: "rgba(246,243,234,0.6)",
            opacity: final,
          }}
        >
          HER FENDE AYNI İMZA
        </span>
        <span
          style={{
            fontFamily: theme.font,
            fontWeight: 900,
            fontSize: 74,
            lineHeight: 1.12,
            textAlign: "center",
            padding: "0 80px",
            letterSpacing: -2,
            background: `linear-gradient(92deg, ${theme.gold}, ${theme.goldSoft} 55%, ${theme.gold})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            opacity: final,
            transform: `translateY(${interpolate(final, [0, 1], [34, 0])}px)`,
          }}
        >
          Allah'ın varlığını ve birliğini görebiliriz.
        </span>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
