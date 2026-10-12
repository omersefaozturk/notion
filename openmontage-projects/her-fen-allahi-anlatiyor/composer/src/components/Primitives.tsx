import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

/** Slide/fade-in wrapper driven by a spring, for stacked reveals. */
export const Reveal: React.FC<{
  delay?: number;
  from?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ delay = 0, from = 40, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200, mass: 0.6 } });
  return (
    <div
      style={{
        ...style,
        opacity: s,
        transform: `translateY(${interpolate(s, [0, 1], [from, 0])}px)`,
      }}
    >
      {children}
    </div>
  );
};

/** The scene's own headline, above the artwork. */
export const SceneTitle: React.FC<{ text: string; accent?: string; delay?: number }> = ({
  text,
  accent = theme.gold,
  delay = 0,
}) => (
  <Reveal delay={delay} from={26}>
    <div style={{ textAlign: "center", padding: "0 80px" }}>
      <span
        style={{
          fontFamily: theme.font,
          fontWeight: 800,
          fontSize: 54,
          letterSpacing: -1,
          color: accent,
          textWrap: "balance",
        }}
      >
        {text}
      </span>
    </div>
  </Reveal>
);

/** Rounded data panel used across the measurement scenes. */
export const Panel: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <div
    style={{
      background: theme.panel,
      border: `1.5px solid ${theme.panelLine}`,
      borderRadius: 26,
      padding: "28px 32px",
      boxShadow: "0 18px 48px rgba(0,0,0,0.38)",
      ...style,
    }}
  >
    {children}
  </div>
);

export const Cross: React.FC<{ size?: number; progress: number; color?: string }> = ({
  size = 120,
  progress,
  color = theme.warn,
}) => {
  const p = Math.max(0, Math.min(1, progress));
  const len = size * 1.42;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <line
        x1={size * 0.12}
        y1={size * 0.12}
        x2={size * 0.88}
        y2={size * 0.88}
        stroke={color}
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - Math.min(1, p * 2))}
      />
      <line
        x1={size * 0.88}
        y1={size * 0.12}
        x2={size * 0.12}
        y2={size * 0.88}
        stroke={color}
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - Math.max(0, p * 2 - 1))}
      />
    </svg>
  );
};
