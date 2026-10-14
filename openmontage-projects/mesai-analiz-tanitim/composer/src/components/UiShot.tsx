import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { VIEW, theme } from "../theme";

export type Shot = {
  id: string;
  image: string;
  focus: number[] | null;
  highlights: number[][];
  cursor: number[] | null;
  click: boolean;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Camera: hold the whole page, then ease into the focus box and stay there. */
function camera(focus: number[] | null, t: number) {
  if (!focus) {
    return { scale: 1, x: 0, y: 0 };          // whole page, held still
  }
  const [fx, fy, fw, fh] = focus;
  // Leave air around the box, never crop a wide one, never push past 2.4x.
  const target = clamp(Math.min(VIEW.w / fw, VIEW.h / fh) * 0.82, 1.0, 2.4);
  if (target < 1.06) {
    return { scale: 1, x: 0, y: 0 };          // box already fills the frame
  }
  // Ease in once, then hold perfectly still: a frozen frame costs the encoder
  // almost nothing, and dense tables are easier to read when they stop moving.
  const ease = interpolate(t, [0.1, 0.42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (x) => 1 - Math.pow(1 - x, 3),
  });
  const scale = 1 + (target - 1) * ease;
  const cx = fx + fw / 2;
  const cy = fy + fh / 2;
  const wantX = VIEW.w / 2 - cx * scale;
  const wantY = VIEW.h / 2 - cy * scale;
  return {
    scale,
    x: clamp(wantX * ease, VIEW.w - VIEW.w * scale, 0),
    y: clamp(wantY * ease, VIEW.h - VIEW.h * scale, 0),
  };
}

const Cursor: React.FC<{ scale: number; appear: number }> = ({ scale, appear }) => (
  <svg
    width={34}
    height={44}
    viewBox="0 0 34 44"
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      transform: `scale(${1 / scale}) translate(${interpolate(appear, [0, 1], [26, 0])}px, ${interpolate(
        appear,
        [0, 1],
        [34, 0]
      )}px)`,
      transformOrigin: "0 0",
      opacity: appear,
      filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.45))",
    }}
  >
    <path d="M3 2 L3 33 L11 26 L16 38 L22 35 L17 24 L28 23 Z" fill="#fff" stroke="#0E1A2B" strokeWidth={2.4} strokeLinejoin="round" />
  </svg>
);

export const UiShot: React.FC<{ shot: Shot; durationInFrames: number }> = ({ shot, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / Math.max(1, durationInFrames);
  const cam = camera(shot.focus, t);

  const ringIn = interpolate(frame, [Math.round(fps * 0.75), Math.round(fps * 1.15)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cursorIn = interpolate(frame, [Math.round(fps * 0.5), Math.round(fps * 1.0)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const clickAt = Math.round(fps * 1.35);
  const clickT = interpolate(frame, [clickAt, clickAt + Math.round(fps * 0.55)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        width: VIEW.w,
        height: VIEW.h,
        transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.scale})`,
        transformOrigin: "0 0",
      }}
    >
      <Img src={staticFile(shot.image)} style={{ width: VIEW.w, height: VIEW.h, display: "block" }} />

      {shot.highlights.map(([x, y, w, h], i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: w,
            height: h,
            border: `${3 / cam.scale + 1.4}px solid ${theme.ring}`,
            borderRadius: 12 / cam.scale + 4,
            boxShadow: `0 0 ${22 / cam.scale}px rgba(255,176,32,0.55)`,
            opacity: ringIn,
            transform: `scale(${interpolate(ringIn, [0, 1], [1.05, 1])})`,
            transformOrigin: "center",
            pointerEvents: "none",
          }}
        />
      ))}

      {shot.cursor ? (
        <div style={{ position: "absolute", left: shot.cursor[0], top: shot.cursor[1] }}>
          {shot.click ? (
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: 1,
                height: 1,
                transform: `scale(${1 / cam.scale})`,
                transformOrigin: "0 0",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: -interpolate(clickT, [0, 1], [10, 58]),
                  top: -interpolate(clickT, [0, 1], [10, 58]),
                  width: interpolate(clickT, [0, 1], [20, 116]),
                  height: interpolate(clickT, [0, 1], [20, 116]),
                  borderRadius: 999,
                  border: `4px solid ${theme.ring}`,
                  opacity: interpolate(clickT, [0, 0.15, 1], [0, 0.8, 0]),
                }}
              />
            </div>
          ) : null}
          <Cursor scale={cam.scale} appear={cursorIn} />
        </div>
      ) : null}
    </div>
  );
};
