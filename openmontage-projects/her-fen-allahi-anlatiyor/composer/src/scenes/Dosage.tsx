import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { Panel, Reveal } from "../components/Primitives";
import { theme } from "../theme";

const DOSES = [
  { name: "A maddesi", value: 0.1 },
  { name: "B maddesi", value: 0.3 },
  { name: "C maddesi", value: 0.15 },
];

const fmt = (v: number) => v.toFixed(2).replace(".", ",");

export const DosageScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const breakPoint = Math.round(durationInFrames * 0.52);
  const broken = frame > breakPoint;
  const brokenT = interpolate(frame, [breakPoint, breakPoint + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tilt = broken ? interpolate(brokenT, [0, 1], [0, 11]) : Math.sin(frame / 18) * 0.7;

  return (
    <AbsoluteFill>
      <Backdrop seed="dosage" stars={70} glow={broken ? "rgba(232,86,78,0.18)" : "rgba(233,185,73,0.16)"} />
      {/* balance scale */}
      <svg width={1080} height={1920} style={{ position: "absolute", top: 0 }}>
        <g transform="translate(540 700)">
          <rect x={-10} y={0} width={20} height={240} rx={8} fill="rgba(246,243,234,0.35)" />
          <rect x={-130} y={238} width={260} height={16} rx={8} fill="rgba(246,243,234,0.35)" />
          <g transform={`rotate(${tilt})`}>
            <rect x={-300} y={-12} width={600} height={16} rx={8} fill="rgba(246,243,234,0.6)" />
            {[-260, 260].map((x, i) => (
              <g key={i} transform={`translate(${x} 4)`}>
                <line x1={0} y1={0} x2={0} y2={70} stroke="rgba(246,243,234,0.45)" strokeWidth={3} />
                <path
                  d="M-78 70 L78 70 L52 126 L-52 126 Z"
                  fill={broken ? "rgba(232,86,78,0.26)" : "rgba(84,214,196,0.22)"}
                  stroke={broken ? theme.warn : theme.teal}
                  strokeWidth={3}
                />
              </g>
            ))}
          </g>
          <circle cx={0} cy={-12} r={16} fill={theme.gold} />
        </g>
      </svg>

      <AbsoluteFill style={{ paddingTop: 1010, alignItems: "center", flexDirection: "column", gap: 20 }}>
        {DOSES.map((d, i) => {
          const appear = i * 9;
          const t = interpolate(frame - appear, [0, 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const drift = broken ? (i === 1 ? 0.23 : i === 0 ? 0.04 : 0.09) : 0;
          const shown = d.value * t + drift * brokenT;
          return (
            <Reveal key={d.name} delay={appear} from={30}>
              <Panel
                style={{
                  width: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderColor: broken ? "rgba(232,86,78,0.5)" : theme.panelLine,
                  padding: "22px 32px",
                }}
              >
                <span style={{ fontFamily: theme.font, fontWeight: 600, fontSize: 40, color: theme.inkSoft }}>
                  {d.name}
                </span>
                <span
                  style={{
                    fontFamily: theme.font,
                    fontWeight: 900,
                    fontSize: 52,
                    color: broken ? theme.warn : theme.gold,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmt(shown)} g
                </span>
              </Panel>
            </Reveal>
          );
        })}

        <div
          style={{
            marginTop: 26,
            opacity: brokenT,
            transform: `scale(${interpolate(brokenT, [0, 1], [0.8, 1])}) rotate(-5deg)`,
          }}
        >
          <span
            style={{
              fontFamily: theme.font,
              fontWeight: 900,
              fontSize: 56,
              letterSpacing: 2,
              color: theme.warn,
              border: `5px solid ${theme.warn}`,
              borderRadius: 14,
              padding: "14px 30px",
              background: "rgba(232,86,78,0.1)",
            }}
          >
            ÖLÇÜ BOZULDU → İLAÇ DEĞİL
          </span>
        </div>
      </AbsoluteFill>
      {broken ? (
        <AbsoluteFill
          style={{
            background: "rgba(232,86,78,0.1)",
            opacity: interpolate(frame, [breakPoint, breakPoint + 6, breakPoint + 16], [0, 1, 0], {
              extrapolateRight: "clamp",
            }),
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
