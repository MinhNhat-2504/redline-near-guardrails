
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/frontend.css";
import { lazy, Suspense } from "react";
const NearApp = lazy(() => import("./near/NearApp"));
const LegacyRoot = lazy(() => import("./LegacyRoot"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={<p>Đang tải REDLINE…</p>}>{location.pathname === "/near" || location.pathname.startsWith("/near/") ? <NearApp /> : <LegacyRoot />}</Suspense>
  </StrictMode>,
);
