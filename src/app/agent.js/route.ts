import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    // Derive base URL from the incoming request so this works in every
    // environment (local dev, staging, production) without configuration.
    const proto   = req.headers.get("x-forwarded-proto") ?? "https"
    const host    = req.headers.get("host") ?? "localhost:3000"
    const baseUrl = `${proto}://${host}`;

    const js = `
(function () {
  if (window.AIScriptoAgent) return;

  const script = document.currentScript;

  const tenant = script.getAttribute("data-tenant");
  const token = script.getAttribute("data-token");
  const shop = script.getAttribute("data-shop");
  const theme = script.getAttribute("data-theme");

  if (!tenant || !token || !shop) {
    console.error("AI Agent: Missing tenant, token, or shop");
    return;
  }

  let isLoaded = false;

  function rgbToHex(rgb) {
    const m = rgb.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
    if (!m) return null;
    const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
    if ((r + g + b < 30) || (r + g + b > 720)) return null;
    return "#" + r.toString(16).padStart(2,"0") + g.toString(16).padStart(2,"0") + b.toString(16).padStart(2,"0");
  }

  function detectPrimaryColor() {
    const CSS_VARS = ["--primary","--primary-color","--brand-color","--color-primary","--theme-primary","--accent-color","--accent","--brand"];
    const root = getComputedStyle(document.documentElement);
    for (const v of CSS_VARS) {
      const val = root.getPropertyValue(v).trim();
      if (/^#[0-9a-fA-F]{6}$/.test(val)) return val;
      if (/^#[0-9a-fA-F]{3}$/.test(val)) return "#"+val[1]+val[1]+val[2]+val[2]+val[3]+val[3];
    }
    const BTNS = ['button[class*="primary"]','a[class*="primary"]','.btn-primary','.button-primary','[data-brand]'];
    for (const sel of BTNS) {
      const el = document.querySelector(sel);
      if (el) { const c = rgbToHex(getComputedStyle(el).backgroundColor); if (c) return c; }
    }
    const header = document.querySelector("header") || document.querySelector("nav");
    if (header) { const c = rgbToHex(getComputedStyle(header).backgroundColor); if (c) return c; }
    return null;
  }

  function createUI() {
    const button = document.createElement("button");
    button.innerHTML = "💬";

    Object.assign(button.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      width: "60px",
      height: "60px",
      borderRadius: "50%",
      background: "#007bff",
      color: "#fff",
      border: "none",
      fontSize: "26px",
      cursor: "pointer",
      zIndex: "999999",
      boxShadow: "0 4px 15px rgba(0,0,0,0.3)"
    });

    const container = document.createElement("div");

    Object.assign(container.style, {
      position: "fixed",
      bottom: "90px",
      right: "20px",
      width: "420px",
      height: "680px",
      display: "none",
      borderRadius: "12px",
      overflow: "hidden",
      boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
      background: "#fff",
      zIndex: "999999"
    });

    document.body.appendChild(container);
    document.body.appendChild(button);

    button.onclick = function () {
      if (!isLoaded) {
        const url = new URL("${baseUrl}/voice");

        url.searchParams.set("tenant", tenant);
        url.searchParams.set("token", token);
        url.searchParams.set("shop", shop);

        const primaryColor = detectPrimaryColor();
        if (primaryColor) url.searchParams.set("primaryColor", primaryColor);
        if (/^(nexus|daylight|emerald|ember)$/.test(theme || "")) url.searchParams.set("theme", theme);

        const iframe = document.createElement("iframe");
        iframe.src = url.toString();
        iframe.allow = "microphone; autoplay";

        Object.assign(iframe.style, {
          width: "100%",
          height: "100%",
          border: "0"
        });

        container.appendChild(iframe);
        isLoaded = true;
      }

      container.style.display =
        container.style.display === "none" ? "block" : "none";
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createUI);
  } else {
    createUI();
  }

  window.AIScriptoAgent = true;
})();
`;

    return new NextResponse(js, {
        headers: {
            "Content-Type": "application/javascript",
            "Cache-Control": "public, max-age=86400"
        }
    });
}
