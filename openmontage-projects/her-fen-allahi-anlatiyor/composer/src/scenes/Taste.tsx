import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { Cross, SceneTitle } from "../components/Primitives";
import { theme } from "../theme";

const TESTS = [
  { taste: "EKŞİ", like: "limon gibi", color: "#f2d14b" },
  { taste: "TATLI", like: "kayısı gibi", color: "#f0a04b" },
  { taste: "ACI", like: "biber gibi", color: "#d6372f" },
];

export const TasteScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const quote = interpolate(frame, [Math.round(durationInFrames * 0.58), Math.round(durationInFrames * 0.58) + 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Backdrop seed="taste" stars={50} glow="rgba(233,185,73,0.14)" />
      <AbsoluteFill style={{ paddingTop: 250, alignItems: "center" }}>
        <SceneTitle text="Toprağın tadına bakalım" />
      </AbsoluteFill>

      <AbsoluteFill style={{ paddingTop: 470, alignItems: "center", flexDirection: "column", gap: 26 }}>
        {TESTS.map((t, i) => {
          const appear = interpolate(frame - 8 - i * 14, [0, 18], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const crossP = interpolate(frame - 26 - i * 14, [0, 18], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={t.taste}
              style={{
                width: 840,
                display: "flex",
                alignItems: "center",
                gap: 28,
                background: theme.panel,
                border: `1.5px solid ${theme.panelLine}`,
                borderRadius: 24,
                padding: "20px 30px",
                opacity: appear,
                transform: `translateX(${interpolate(appear, [0, 1], [-30, 0])}px)`,
              }}
            >
              <div
                style={{
                  width: 78,
                  height: 78,
                  borderRadius: 18,
                  background: t.color,
                  flexShrink: 0,
                }}
              />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontFamily: theme.font, fontWeight: 900, fontSize: 46, color: theme.ink }}>
                  {t.taste}
                </span>
                <span style={{ fontFamily: theme.font, fontWeight: 500, fontSize: 30, color: theme.inkSoft }}>
                  {t.like}
                </span>
              </div>
              <div style={{ flex: 1 }} />
              <span style={{ fontFamily: theme.font, fontWeight: 700, fontSize: 32, color: "rgba(246,243,234,0.5)" }}>
                toprakta
              </span>
              <div style={{ width: 90, height: 90, display: "flex", alignItems: "center" }}>
                <Cross size={82} progress={crossP} />
              </div>
            </div>
          );
        })}

        <div
          style={{
            marginTop: 40,
            width: 880,
            opacity: quote,
            transform: `translateY(${interpolate(quote, [0, 1], [30, 0])}px)`,
            background: "rgba(233,185,73,0.08)",
            border: `2px solid ${theme.panelLine}`,
            borderLeft: `8px solid ${theme.gold}`,
            borderRadius: 22,
            padding: "30px 34px",
          }}
        >
          <span
            style={{
              fontFamily: theme.font,
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 54,
              lineHeight: 1.2,
              color: theme.goldSoft,
            }}
          >
            «Bütün bunları yapan ben değilim.»
          </span>
          <div style={{ height: 12 }} />
          <span style={{ fontFamily: theme.font, fontWeight: 600, fontSize: 32, color: theme.inkSoft }}>
            — toprak, hâl diliyle
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
