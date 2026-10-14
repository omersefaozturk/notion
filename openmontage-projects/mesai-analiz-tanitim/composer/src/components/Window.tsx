import React from "react";
import { VIEW, WINDOW, theme } from "../theme";

/** A browser window frame around the captured viewport. */
export const Window: React.FC<{ step: string; children: React.ReactNode }> = ({ step, children }) => (
  <div
    style={{
      position: "absolute",
      left: WINDOW.x,
      top: WINDOW.y - WINDOW.chrome,
      width: VIEW.w,
      borderRadius: 16,
      overflow: "hidden",
      boxShadow: "0 40px 90px -20px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.08)",
      background: "#111A2B",
    }}
  >
    <div
      style={{
        height: WINDOW.chrome,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 16px",
        background: "linear-gradient(180deg, #1B2538, #141D2E)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
        <span key={c} style={{ width: 12, height: 12, borderRadius: 999, background: c, opacity: 0.9 }} />
      ))}
      <div
        style={{
          margin: "0 auto",
          padding: "5px 18px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.07)",
          fontFamily: theme.font,
          fontSize: 16,
          fontWeight: 500,
          color: "rgba(244,247,252,0.72)",
        }}
      >
        mesai-analiz.html — BDKS Mesai Analizi
      </div>
      <span
        style={{
          fontFamily: theme.mono,
          fontSize: 15,
          color: "rgba(244,247,252,0.45)",
          minWidth: 52,
          textAlign: "right",
        }}
      >
        {step}
      </span>
    </div>
    <div style={{ position: "relative", width: VIEW.w, height: VIEW.h, overflow: "hidden", background: "#fff" }}>
      {children}
    </div>
  </div>
);
