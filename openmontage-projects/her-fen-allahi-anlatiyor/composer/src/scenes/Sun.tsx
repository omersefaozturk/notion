import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { Cross, SceneTitle } from "../components/Primitives";
import { theme } from "../theme";

const FUELS = [
  { label: "GAZYAĞI", note: "denizler kadar" },
  { label: "KÖMÜR", note: "dağlar kadar" },
  { label: "ODUN", note: "yığınlar kadar" },
];

export const SunScene: React.FC = () => {
  const frame = useCurrentFrame();
  const cx = 540;
  const cy = 700;
  const pulse = 1 + Math.sin(frame / 14) * 0.02;

  return (
    <AbsoluteFill>
      <Backdrop seed="sun" stars={90} glow="rgba(255,196,80,0.26)" />
      <AbsoluteFill style={{ paddingTop: 250, alignItems: "center" }}>
        <SceneTitle text="Güneş: yakıtsız yanan lamba" />
      </AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <defs>
          <radialGradient id="sunCore" cx="50%" cy="46%" r="60%">
            <stop offset="0%" stopColor="#fff6d8" />
            <stop offset="45%" stopColor="#ffc947" />
            <stop offset="100%" stopColor="#e07a1f" />
          </radialGradient>
          <radialGradient id="sunHalo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,201,71,0.5)" />
            <stop offset="100%" stopColor="rgba(255,201,71,0)" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={420} fill="url(#sunHalo)" />
        {new Array(42).fill(0).map((_, i) => {
          const a = (i / 42) * Math.PI * 2;
          const len = 236 + 52 * Math.abs(Math.sin(frame / 11 + i));
          return (
            <line
              key={i}
              x1={cx + 208 * Math.cos(a)}
              y1={cy + 208 * Math.sin(a)}
              x2={cx + len * Math.cos(a)}
              y2={cy + len * Math.sin(a)}
              stroke="rgba(255,201,71,0.55)"
              strokeWidth={5}
              strokeLinecap="round"
            />
          );
        })}
        <circle cx={cx} cy={cy} r={200 * pulse} fill="url(#sunCore)" />
        {new Array(14).fill(0).map((_, i) => {
          const a = random(`sp-${i}`) * Math.PI * 2 + frame / 90;
          const r = 60 + random(`sr-${i}`) * 120;
          return (
            <circle
              key={i}
              cx={cx + r * Math.cos(a)}
              cy={cy + r * Math.sin(a)}
              r={8 + random(`ss-${i}`) * 16}
              fill="rgba(255,120,30,0.35)"
            />
          );
        })}
      </svg>

      <AbsoluteFill style={{ paddingTop: 1030, alignItems: "center", flexDirection: "column", gap: 16 }}>
        {FUELS.map((f, i) => {
          const appear = interpolate(frame - 10 - i * 12, [0, 16], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const crossP = interpolate(frame - 26 - i * 12, [0, 16], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={f.label}
              style={{
                width: 820,
                display: "flex",
                alignItems: "center",
                gap: 24,
                background: theme.panel,
                border: `1.5px solid ${theme.panelLine}`,
                borderRadius: 22,
                padding: "14px 26px",
                opacity: appear,
              }}
            >
              <div style={{ width: 72, height: 72 }}>
                <Cross size={72} progress={crossP} />
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontFamily: theme.font, fontWeight: 900, fontSize: 40, color: theme.ink }}>
                  {f.label}
                </span>
                <span style={{ fontFamily: theme.font, fontWeight: 500, fontSize: 28, color: theme.inkSoft }}>
                  {f.note} gerekirdi
                </span>
              </div>
              <div style={{ flex: 1 }} />
              <span style={{ fontFamily: theme.font, fontWeight: 900, fontSize: 44, color: theme.warn }}>
                yok
              </span>
            </div>
          );
        })}
        <span
          style={{
            marginTop: 22,
            fontFamily: theme.font,
            fontWeight: 900,
            fontSize: 52,
            color: theme.gold,
            opacity: interpolate(frame, [110, 135], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          yine de hiç sönmüyor
        </span>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
