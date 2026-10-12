import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { SceneTitle } from "../components/Primitives";
import { theme } from "../theme";

const Gauge: React.FC<{
  label: string;
  unit: string;
  value: number;      // 0..1 position of the needle
  safe: [number, number];
  verdict: string;
  bad: boolean;
  t: number;
}> = ({ label, unit, value, safe, verdict, bad, t }) => {
  const w = 760;
  const pos = interpolate(t, [0, 1], [0.5, value]);
  return (
    <div style={{ width: w, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: theme.font, fontWeight: 800, fontSize: 40, color: theme.ink }}>{label}</span>
        <span style={{ fontFamily: theme.font, fontWeight: 600, fontSize: 30, color: theme.inkSoft }}>{unit}</span>
      </div>
      <div
        style={{
          position: "relative",
          height: 34,
          borderRadius: 999,
          background: "linear-gradient(90deg, rgba(232,86,78,0.55), rgba(111,208,140,0.55) 50%, rgba(232,86,78,0.55))",
          border: "1.5px solid rgba(246,243,234,0.2)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: `${safe[0] * 100}%`,
            width: `${(safe[1] - safe[0]) * 100}%`,
            top: -6,
            bottom: -6,
            border: `2px dashed ${theme.green}`,
            borderRadius: 999,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `calc(${pos * 100}% - 12px)`,
            top: -14,
            width: 24,
            height: 62,
            borderRadius: 8,
            background: bad ? theme.warn : theme.goldSoft,
            boxShadow: `0 0 22px ${bad ? "rgba(232,86,78,0.8)" : "rgba(246,220,160,0.7)"}`,
          }}
        />
      </div>
      <span
        style={{
          fontFamily: theme.font,
          fontWeight: 800,
          fontSize: 34,
          color: bad ? theme.warn : theme.green,
          opacity: interpolate(t, [0.55, 1], [0, 1], { extrapolateLeft: "clamp" }),
        }}
      >
        {verdict}
      </span>
    </div>
  );
};

export const BodyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t1 = interpolate(frame, [20, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const t2 = interpolate(frame, [Math.round(durationInFrames * 0.45), Math.round(durationInFrames * 0.45) + 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const beat = 1 + Math.abs(Math.sin(frame / 9)) * 0.08;

  return (
    <AbsoluteFill>
      <Backdrop seed="body" stars={60} glow="rgba(159,212,255,0.12)" />
      <AbsoluteFill style={{ paddingTop: 250, alignItems: "center" }}>
        <SceneTitle text="İnsan vücudu: hassas bir denge" />
      </AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <g transform="translate(540 700)" opacity={0.95}>
          <circle cx={0} cy={-120} r={62} fill="none" stroke="rgba(159,212,255,0.6)" strokeWidth={4} />
          <path
            d="M0 -56 C -70 -56 -104 -10 -104 60 L-104 190 C -104 210 -86 210 -82 190 L-70 120 L-70 300 C -70 322 -40 322 -38 300 L-28 150 L28 150 L38 300 C 40 322 70 322 70 300 L70 120 L82 190 C 86 210 104 210 104 190 L104 60 C 104 -10 70 -56 0 -56 Z"
            fill="rgba(159,212,255,0.12)"
            stroke="rgba(159,212,255,0.55)"
            strokeWidth={4}
          />
          <g transform={`translate(0 30) scale(${beat})`}>
            <path
              d="M0 24 C -30 -14 -58 -2 -58 22 C -58 48 -22 66 0 88 C 22 66 58 48 58 22 C 58 -2 30 -14 0 24 Z"
              fill={theme.warn}
              opacity={0.9}
            />
          </g>
          {new Array(5).fill(0).map((_, i) => {
            const p = ((frame * 2 + i * 60) % 300) / 300;
            return (
              <circle
                key={i}
                cx={interpolate(p, [0, 1], [-10, 10])}
                cy={interpolate(p, [0, 1], [60, 300])}
                r={5}
                fill={theme.warn}
                opacity={0.5}
              />
            );
          })}
        </g>
      </svg>

      <AbsoluteFill style={{ paddingTop: 1140, alignItems: "center", flexDirection: "column", gap: 54 }}>
        <Gauge
          label="KAN ŞEKERİ"
          unit="mg/dL"
          value={0.9}
          safe={[0.34, 0.6]}
          verdict="fazla → şeker hastalığı"
          bad
          t={t1}
        />
        <Gauge label="DEMİR" unit="µg/dL" value={0.08} safe={[0.4, 0.66]} verdict="eksik → kansızlık" bad t={t2} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
