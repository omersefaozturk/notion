import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { SceneTitle } from "../components/Primitives";
import { theme } from "../theme";

const ORBITS = [
  { rx: 150, ry: 58, speed: 20, color: "#9fd4ff", size: 13, tilt: -16 },
  { rx: 240, ry: 96, speed: 31, color: "#f2a1a1", size: 17, tilt: 8 },
  { rx: 330, ry: 132, speed: 44, color: "#6fd08c", size: 15, tilt: -6 },
  { rx: 420, ry: 170, speed: 58, color: "#e9b949", size: 20, tilt: 14 },
];

export const StarsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const cx = 540;
  const cy = 860;
  const badge = interpolate(frame, [Math.round(durationInFrames * 0.5), Math.round(durationInFrames * 0.5) + 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Backdrop seed="stars" stars={210} glow="rgba(233,185,73,0.18)" />
      <AbsoluteFill style={{ paddingTop: 250, alignItems: "center" }}>
        <SceneTitle text="Düzen var, çarpışma yok" />
      </AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <circle cx={cx} cy={cy} r={60} fill="#ffe9a8" />
        <circle cx={cx} cy={cy} r={92} fill="rgba(255,233,168,0.18)" />
        {ORBITS.map((o, i) => {
          const a = frame / o.speed + i;
          const x0 = o.rx * Math.cos(a);
          const y0 = o.ry * Math.sin(a);
          const rot = (o.tilt * Math.PI) / 180;
          return (
            <g key={i}>
              <ellipse
                cx={cx}
                cy={cy}
                rx={o.rx}
                ry={o.ry}
                fill="none"
                stroke="rgba(246,243,234,0.18)"
                strokeWidth={2}
                transform={`rotate(${o.tilt} ${cx} ${cy})`}
              />
              <circle
                cx={cx + x0 * Math.cos(rot) - y0 * Math.sin(rot)}
                cy={cy + x0 * Math.sin(rot) + y0 * Math.cos(rot)}
                r={o.size}
                fill={o.color}
              />
            </g>
          );
        })}
      </svg>

      <AbsoluteFill style={{ paddingTop: 1300, alignItems: "center", flexDirection: "column", gap: 22 }}>
        <div
          style={{
            opacity: badge,
            transform: `scale(${interpolate(badge, [0, 1], [0.86, 1])})`,
            display: "flex",
            gap: 18,
          }}
        >
          {["YAKITSIZ", "SÖNMEDEN", "ÇARPIŞMADAN"].map((w) => (
            <span
              key={w}
              style={{
                fontFamily: theme.font,
                fontWeight: 800,
                fontSize: 36,
                letterSpacing: 2,
                color: theme.ink,
                border: `2px solid ${theme.panelLine}`,
                borderRadius: 999,
                padding: "14px 26px",
                background: "rgba(10,16,32,0.6)",
              }}
            >
              {w}
            </span>
          ))}
        </div>
        <span
          style={{
            marginTop: 16,
            fontFamily: theme.font,
            fontWeight: 900,
            fontSize: 62,
            letterSpacing: -1,
            color: theme.gold,
            opacity: interpolate(frame, [Math.round(durationInFrames * 0.66), Math.round(durationInFrames * 0.66) + 22], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          O, Yüce Allah'tır.
        </span>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
