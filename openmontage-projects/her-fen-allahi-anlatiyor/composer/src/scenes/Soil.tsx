import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { Cross, SceneTitle } from "../components/Primitives";
import { theme } from "../theme";

const ITEMS = [
  { label: "FABRİKA", icon: "factory" },
  { label: "MAKİNE", icon: "gear" },
  { label: "İŞÇİ", icon: "worker" },
];

const Icon: React.FC<{ kind: string; frame: number }> = ({ kind, frame }) => (
  <svg width={140} height={140} viewBox="0 0 140 140">
    {kind === "factory" ? (
      <g fill="rgba(246,243,234,0.55)">
        <path d="M18 120 L18 62 L50 82 L50 62 L82 82 L82 48 L122 48 L122 120 Z" />
        <rect x={96} y={18} width={16} height={32} />
      </g>
    ) : null}
    {kind === "gear" ? (
      <g transform={`rotate(${frame * 1.4} 70 70)`} fill="rgba(246,243,234,0.55)">
        {new Array(8).fill(0).map((_, i) => (
          <rect key={i} x={62} y={8} width={16} height={28} rx={4} transform={`rotate(${i * 45} 70 70)`} />
        ))}
        <circle cx={70} cy={70} r={38} />
        <circle cx={70} cy={70} r={16} fill={theme.bgDeep} />
      </g>
    ) : null}
    {kind === "worker" ? (
      <g fill="rgba(246,243,234,0.55)">
        <path d="M40 48 C 40 24 100 24 100 48 L106 54 L34 54 Z" />
        <circle cx={70} cy={74} r={18} />
        <path d="M70 96 C 44 96 36 112 36 130 L104 130 C 104 112 96 96 70 96 Z" />
      </g>
    ) : null}
  </svg>
);

export const SoilScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const dig = interpolate(frame, [10, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const camera = interpolate(dig, [0, 1], [0, -260]);

  return (
    <AbsoluteFill>
      <Backdrop seed="soil" stars={40} glow="rgba(140,110,70,0.16)" />
      <AbsoluteFill style={{ paddingTop: 250, alignItems: "center" }}>
        <SceneTitle text="Toprağın altına bakalım" />
      </AbsoluteFill>
      <AbsoluteFill style={{ transform: `translateY(${camera}px)` }}>
        <svg width={1080} height={1920} style={{ position: "absolute" }}>
          {/* sprout + surface */}
          <g transform="translate(540 690)">
            <path
              d="M0 0 C 0 -40 -4 -74 -10 -104"
              stroke="#4f9e4a"
              strokeWidth={9}
              fill="none"
              strokeLinecap="round"
            />
            <path d="M-10 -96 C -56 -120 -74 -84 -40 -62 C -18 -50 -10 -72 -10 -96 Z" fill="#5fb455" />
            <path d="M-8 -70 C 38 -96 60 -58 24 -38 C 2 -26 -8 -48 -8 -70 Z" fill="#4f9e4a" />
          </g>
          <rect x={0} y={690} width={1080} height={110} fill="#6b4f33" />
          <rect x={0} y={800} width={1080} height={150} fill="#573f28" />
          <rect x={0} y={950} width={1080} height={200} fill="#42301e" />
          <rect x={0} y={1150} width={1080} height={1000} fill="#2b2015" />
          {new Array(40).fill(0).map((_, i) => (
            <circle
              key={i}
              cx={(i * 137) % 1060 + 10}
              cy={720 + ((i * 97) % 1100)}
              r={3 + (i % 4)}
              fill="rgba(0,0,0,0.25)"
            />
          ))}
        </svg>

        <div
          style={{
            position: "absolute",
            top: 1230,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            gap: 40,
          }}
        >
          {ITEMS.map((it, i) => {
            const appear = interpolate(frame - 54 - i * 14, [0, 18], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const crossP = interpolate(frame - 70 - i * 14, [0, 20], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={it.label}
                style={{
                  width: 280,
                  background: "rgba(10,8,6,0.6)",
                  border: "1.5px solid rgba(246,243,234,0.16)",
                  borderRadius: 24,
                  padding: "22px 10px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  opacity: appear,
                  position: "relative",
                }}
              >
                <Icon kind={it.icon} frame={frame} />
                <span style={{ fontFamily: theme.font, fontWeight: 800, fontSize: 36, color: "rgba(246,243,234,0.7)" }}>
                  {it.label}
                </span>
                <div style={{ position: "absolute", top: 26, left: 70 }}>
                  <Cross size={140} progress={crossP} />
                </div>
              </div>
            );
          })}
        </div>
        <div
          style={{
            position: "absolute",
            top: 1480,
            left: 0,
            right: 0,
            textAlign: "center",
            opacity: interpolate(frame, [Math.round(durationInFrames * 0.7), Math.round(durationInFrames * 0.7) + 18], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <span style={{ fontFamily: theme.font, fontWeight: 900, fontSize: 52, color: theme.gold }}>
            ne fabrika, ne makine, ne işçi
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
