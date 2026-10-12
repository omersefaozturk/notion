import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

/** Top wordmark + discipline chip + bottom progress bar: the constant frame. */
export const Chrome: React.FC<{ label?: string }> = ({ label }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = frame / durationInFrames;
  const intro = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: 74,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          opacity: intro,
        }}
      >
        <span
          style={{
            fontFamily: theme.font,
            fontWeight: 700,
            fontSize: 24,
            letterSpacing: 7,
            color: "rgba(246,243,234,0.46)",
          }}
        >
          HER FEN ALLAH'I ANLATIYOR
        </span>
        {label ? (
          <span
            style={{
              fontFamily: theme.font,
              fontWeight: 800,
              fontSize: 26,
              letterSpacing: 5,
              color: theme.gold,
              border: `1.5px solid ${theme.panelLine}`,
              borderRadius: 999,
              padding: "10px 26px",
              background: "rgba(10,16,32,0.6)",
            }}
          >
            {label}
          </span>
        ) : null}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 96,
          left: 96,
          right: 96,
          height: 5,
          borderRadius: 999,
          background: "rgba(246,243,234,0.12)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${theme.gold}, ${theme.goldSoft})`,
          }}
        />
      </div>
    </>
  );
};
