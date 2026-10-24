import { Platform } from "react-native";

/** Draws a memory card to a canvas and saves it as a PNG (web only). */
export async function downloadCard(m, by, abs) {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  const W = 720;
  const H = 1224;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const font = (px, w = "500") => `${w} ${px}px system-ui, -apple-system, "Segoe UI", sans-serif`;

  g.fillStyle = "#05060f";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#08090e";
  rr(g, 24, 24, W - 48, H - 48, 36);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.18)";
  g.lineWidth = 2;
  g.stroke();

  const date = m.createdAt ? new Date(m.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
  g.fillStyle = "rgba(238,240,255,0.55)";
  g.font = font(24);
  g.textAlign = "right";
  g.fillText(date, W - 64, 82);
  g.textAlign = "left";
  g.fillStyle = "rgba(238,240,255,0.8)";
  g.font = font(30, "600");
  g.fillText("Remember...?", 64, 128);

  g.textAlign = "center";
  g.fillStyle = "#eef0ff";
  const media = m.photo || m.drawing;
  let y = 200;
  if (media) {
    const img = await loadImage(abs(media));
    const s = W - 128;
    if (img) {
      g.save();
      rr(g, 64, y, s, s, 16);
      g.clip();
      if (m.photo) {
        const k = Math.max(s / img.width, s / img.height);
        g.drawImage(img, 64 + (s - img.width * k) / 2, y + (s - img.height * k) / 2, img.width * k, img.height * k);
      } else {
        g.fillStyle = "#111";
        g.fillRect(64, y, s, s);
        const k = Math.min(s / img.width, s / img.height);
        g.drawImage(img, 64 + (s - img.width * k) / 2, y + (s - img.height * k) / 2, img.width * k, img.height * k);
      }
      g.restore();
    }
    y += s + 60;
    if (m.text) wrap(g, `“${m.text}”`, W / 2, y, W - 160, 40, font(32), "#eef0ff", 6);
  } else {
    const len = (m.text || "").length;
    const px = len < 60 ? 52 : len < 140 ? 42 : 34;
    wrap(g, `“${m.text || ""}”`, W / 2, 330, W - 160, px * 1.4, font(px, "600"), "#eef0ff", 14);
  }

  g.textAlign = "center";
  g.fillStyle = "rgba(238,240,255,0.65)";
  g.font = font(28);
  g.fillText(`by ${by}`, W / 2, H - 80);

  await new Promise((res) => {
    c.toBlob((blob) => {
      if (blob) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `memory-${m.n || ""}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }
      res();
    }, "image/png");
  });
}

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function wrap(g, text, x, y, maxW, lh, font, color, maxLines) {
  g.font = font;
  g.fillStyle = color;
  const words = text.split(/\s+/);
  const lines = [];
  let cur = "";
  words.forEach((w) => {
    const t = cur ? `${cur} ${w}` : w;
    if (g.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  });
  if (cur) lines.push(cur);
  lines.slice(0, maxLines).forEach((l, i) => g.fillText(l, x, y + i * lh));
}

function loadImage(src) {
  return new Promise((res) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });
}
