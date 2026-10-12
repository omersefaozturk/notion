import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { SceneTitle } from "../components/Primitives";
import { theme } from "../theme";

const FRUITS = [
  { name: "limon", trait: "ekşi", color: "#f2d14b", shape: "oval" },
  { name: "kayısı", trait: "tatlı", color: "#f0a04b", shape: "round" },
  { name: "biber", trait: "acı", color: "#d6372f", shape: "pepper" },
  { name: "üzüm", trait: "tatlı", color: "#8e6bd1", shape: "grapes" },
  { name: "kiraz", trait: "mayhoş", color: "#c32148", shape: "cherry" },
  { name: "incir", trait: "ballı", color: "#7d5ba6", shape: "fig" },
];

const FruitArt: React.FC<{ shape: string; color: string }> = ({ shape, color }) => (
  <svg width={150} height={150} viewBox="0 0 150 150">
    {shape === "oval" ? <ellipse cx={75} cy={80} rx={52} ry={40} fill={color} /> : null}
    {shape === "round" ? <circle cx={75} cy={80} r={46} fill={color} /> : null}
    {shape === "pepper" ? (
      <path d="M75 34 C 118 44 128 96 96 122 C 66 146 36 120 44 86 C 50 58 60 40 75 34 Z" fill={color} />
    ) : null}
    {shape === "grapes" ? (
      <g fill={color}>
        {[[75, 50], [53, 74], [97, 74], [75, 90], [57, 108], [93, 108]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={21} />
        ))}
      </g>
    ) : null}
    {shape === "cherry" ? (
      <g fill={color}>
        <circle cx={56} cy={100} r={28} />
        <circle cx={100} cy={106} r={24} />
      </g>
    ) : null}
    {shape === "fig" ? <path d="M75 36 C 112 56 118 112 75 126 C 32 112 38 56 75 36 Z" fill={color} /> : null}
    <path d="M75 40 C 74 24 80 16 88 10" stroke="#6b4a2a" strokeWidth={8} fill="none" strokeLinecap="round" />
    <path d="M88 16 C 112 4 134 18 126 40 C 118 60 94 52 88 34 Z" fill="#4f9e4a" />
  </svg>
);

export const FruitsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const q = interpolate(frame, [Math.round(durationInFrames * 0.62), Math.round(durationInFrames * 0.62) + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Backdrop seed="fruits" stars={60} glow="rgba(240,160,75,0.14)" />
      <AbsoluteFill style={{ paddingTop: 250, alignItems: "center" }}>
        <SceneTitle text="Aynı toprak, aynı su, aynı güneş" />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          paddingTop: 430,
          alignItems: "center",
          justifyContent: "flex-start",
        }}
      >
        <div style={{ width: 880, display: "flex", flexWrap: "wrap", gap: 28, justifyContent: "center" }}>
          {FRUITS.map((f, i) => {
            const s = spring({ frame: frame - i * 7, fps, config: { damping: 160, mass: 0.5 } });
            return (
              <div
                key={f.name}
                style={{
                  width: 270,
                  background: theme.panel,
                  border: `1.5px solid ${theme.panelLine}`,
                  borderRadius: 24,
                  padding: "18px 10px 22px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  opacity: s,
                  transform: `scale(${interpolate(s, [0, 1], [0.8, 1])})`,
                }}
              >
                <FruitArt shape={f.shape} color={f.color} />
                <span style={{ fontFamily: theme.font, fontWeight: 800, fontSize: 38, color: theme.ink }}>
                  {f.name}
                </span>
                <span style={{ fontFamily: theme.font, fontWeight: 600, fontSize: 30, color: f.color }}>
                  {f.trait}
                </span>
              </div>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 44,
            opacity: q,
            transform: `translateY(${interpolate(q, [0, 1], [24, 0])}px)`,
          }}
        >
          <span
            style={{
              fontFamily: theme.font,
              fontWeight: 900,
              fontSize: 58,
              color: theme.gold,
              letterSpacing: -1,
            }}
          >
            farklı renk, tat, koku... neden?
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
