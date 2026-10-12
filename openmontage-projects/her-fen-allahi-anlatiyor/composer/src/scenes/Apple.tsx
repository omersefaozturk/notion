import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { SceneTitle } from "../components/Primitives";
import { theme } from "../theme";

const PARTS = [
  { label: "su", pct: "%85", angle: -150 },
  { label: "şeker", pct: "%10", angle: -60 },
  { label: "lif", pct: "%2,4", angle: 30 },
  { label: "vitamin + mineral", pct: "%2,6", angle: 110 },
];

export const AppleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const breakAt = Math.round(durationInFrames * 0.66);
  const bt = interpolate(frame, [breakAt, breakAt + 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const breathe = 1 + Math.sin(frame / 22) * 0.012;
  const cx = 540;
  const cy = 900;

  return (
    <AbsoluteFill>
      <Backdrop seed="apple" stars={70} glow="rgba(232,86,78,0.14)" />
      <AbsoluteFill style={{ paddingTop: 250, alignItems: "center" }}>
        <SceneTitle text="Kâinattaki ölçü, ilaçtan daha hassas" />
      </AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <defs>
          <radialGradient id="appleSkin" cx="38%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#ff8a7a" />
            <stop offset="55%" stopColor="#d6372f" />
            <stop offset="100%" stopColor="#7d1a18" />
          </radialGradient>
        </defs>
        {/* measurement ring */}
        <circle
          cx={cx}
          cy={cy}
          r={330}
          fill="none"
          stroke="rgba(233,185,73,0.35)"
          strokeWidth={2}
          strokeDasharray="10 14"
          transform={`rotate(${frame * 0.25} ${cx} ${cy})`}
        />
        <circle cx={cx} cy={cy} r={372} fill="none" stroke="rgba(246,243,234,0.1)" strokeWidth={1.5} />

        <g transform={`translate(${cx} ${cy}) scale(${breathe})`} opacity={1 - bt * 0.45}>
          <path
            d="M0 -160 C -40 -200 -120 -196 -150 -140 C -186 -72 -170 60 -104 142 C -66 188 -24 196 0 176 C 24 196 66 188 104 142 C 170 60 186 -72 150 -140 C 120 -196 40 -200 0 -160 Z"
            fill="url(#appleSkin)"
            style={{ filter: bt > 0 ? `saturate(${1 - bt * 0.9}) brightness(${1 - bt * 0.25})` : undefined }}
          />
          <path d="M-4 -168 C -6 -214 6 -236 16 -258" stroke="#6b4a2a" strokeWidth={14} fill="none" strokeLinecap="round" />
          <path d="M18 -246 C 70 -286 128 -262 120 -214 C 112 -170 54 -176 18 -214 Z" fill="#4f9e4a" />
          <ellipse cx={-54} cy={-58} rx={34} ry={48} fill="rgba(255,255,255,0.22)" transform="rotate(-18 -54 -58)" />
        </g>

        {/* composition callouts */}
        {PARTS.map((p, i) => {
          const a = (p.angle * Math.PI) / 180;
          const r = 430;
          const x = cx + r * Math.cos(a);
          const y = cy + r * Math.sin(a) * 0.92;
          const t = interpolate(frame - 12 - i * 8, [0, 16], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <g key={p.label} opacity={t}>
              <line
                x1={cx + 330 * Math.cos(a)}
                y1={cy + 330 * Math.sin(a) * 0.92}
                x2={x}
                y2={y}
                stroke="rgba(233,185,73,0.5)"
                strokeWidth={2}
              />
              <circle cx={x} cy={y} r={7} fill={theme.gold} />
              <text
                x={x + (Math.cos(a) < 0 ? -22 : 22)}
                y={y - 14}
                textAnchor={Math.cos(a) < 0 ? "end" : "start"}
                fill={theme.ink}
                style={{ fontFamily: theme.font, fontWeight: 800, fontSize: 36 }}
              >
                {p.pct}
              </text>
              <text
                x={x + (Math.cos(a) < 0 ? -22 : 22)}
                y={y + 26}
                textAnchor={Math.cos(a) < 0 ? "end" : "start"}
                fill="rgba(246,243,234,0.6)"
                style={{ fontFamily: theme.font, fontWeight: 500, fontSize: 30 }}
              >
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>

      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 470 }}>
        <div style={{ opacity: bt, transform: `translateY(${interpolate(bt, [0, 1], [26, 0])}px)` }}>
          <span
            style={{
              fontFamily: theme.font,
              fontWeight: 900,
              fontSize: 48,
              color: theme.warn,
              background: "rgba(232,86,78,0.12)",
              border: `3px solid ${theme.warn}`,
              borderRadius: 14,
              padding: "14px 28px",
            }}
          >
            ölçü değişirse: elma, elma değil
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
