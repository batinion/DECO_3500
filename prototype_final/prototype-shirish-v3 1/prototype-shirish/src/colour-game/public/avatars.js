// Launch Sequence crew characters — 8 original little astronauts, drawn as SVG.
//
// One file, used everywhere:
//   - the app imports it (rendered with react-native-svg's SvgXml)
//   - the server serves it at /avatars.js for the rocket scene and the briefing clip
//     (exposed there as window.LaunchAvatars)
//
//   avatarSvg(id, { expr, size })   expr: "default" | "wow" (surprised) | "yay" (cheering)
//   CHARACTERS                      [{ id, name, suit, acc }]
//   characterName(id), pickFree(takenIds)
(function () {
  const INK = "#3b4170";
  const GOLD = "#ffd166";

  const CHARACTERS = [
    { id: "nova", name: "Nova", suit: "#ff6ec7", acc: "antenna", face: "smile" },
    { id: "comet", name: "Comet", suit: "#ff9f43", acc: "star", face: "grin" },
    { id: "orbit", name: "Orbit", suit: "#2ec4b6", acc: "headphones", face: "smile" },
    { id: "luna", name: "Luna", suit: "#9b5de5", acc: "ears", face: "wink" },
    { id: "pixel", name: "Pixel", suit: "#4cc9f0", acc: "glasses", face: "smile" },
    { id: "sprout", name: "Sprout", suit: "#3ddc97", acc: "sprout", face: "grin" },
    { id: "blaze", name: "Blaze", suit: "#ef476f", acc: "flame", face: "grin" },
    { id: "moji", name: "Moji", suit: "#f4d35e", acc: "bow", face: "wink" },
  ];

  function get(id) {
    return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
  }

  // ---- parts that sit BEHIND the helmet ----
  function behind(c) {
    switch (c.acc) {
      case "headphones":
        return `<path d="M17 46 Q17 7 50 7 Q83 7 83 46" stroke="${INK}" stroke-width="4" fill="none"/>`;
      case "ears":
        return `<path d="M22 26 L25 3 L42 15 Z" fill="${c.suit}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
                <path d="M78 26 L75 3 L58 15 Z" fill="${c.suit}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
                <path d="M27 18 L28 9 L35 14 Z" fill="#ffd1ec"/><path d="M73 18 L72 9 L65 14 Z" fill="#ffd1ec"/>`;
      case "flame":
        return `<path d="M36 16 Q31 -4 43 1 Q46 -10 53 -1 Q64 -7 63 16 Z" fill="${c.suit}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
                <path d="M44 13 Q44 3 49 6 Q53 0 56 13 Z" fill="${GOLD}"/>`;
      default:
        return "";
    }
  }

  // ---- parts that sit ON TOP of the helmet ----
  function onTop(c) {
    switch (c.acc) {
      case "antenna":
        return `<line x1="50" y1="12" x2="50" y2="3.5" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
                <circle cx="50" cy="4" r="4.2" fill="${GOLD}" stroke="${INK}" stroke-width="2"/>`;
      case "star":
        return `<path d="M73 13 L75.6 18.6 L81.6 19.2 L77 23.2 L78.4 29.2 L73 26 L67.6 29.2 L69 23.2 L64.4 19.2 L70.4 18.6 Z" fill="${GOLD}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`;
      case "headphones":
        return `<rect x="10" y="35" width="11" height="20" rx="5" fill="${c.suit}" stroke="${INK}" stroke-width="2.5"/>
                <rect x="79" y="35" width="11" height="20" rx="5" fill="${c.suit}" stroke="${INK}" stroke-width="2.5"/>`;
      case "sprout":
        return `<path d="M50 12 Q50 6 51 2" stroke="#2a9d6a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
                <path d="M51 4 Q58 -3 64 3 Q57 8 51 4 Z" fill="${c.suit}" stroke="${INK}" stroke-width="1.8"/>
                <path d="M50 6 Q43 0 38 5 Q44 10 50 6 Z" fill="${c.suit}" stroke="${INK}" stroke-width="1.8"/>`;
      case "bow":
        return `<path d="M70 18 L60 10 L61 25 Z" fill="${c.suit}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
                <path d="M70 18 L80 10 L79 25 Z" fill="${c.suit}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
                <circle cx="70" cy="18" r="3.4" fill="${GOLD}" stroke="${INK}" stroke-width="1.8"/>`;
      default:
        return "";
    }
  }

  // ---- the face, seen through the visor ----
  function face(c, expr) {
    const W = "#ffffff";
    const cheeks = `<circle cx="33" cy="53" r="3.6" fill="#ff8fc7" opacity=".55"/><circle cx="67" cy="53" r="3.6" fill="#ff8fc7" opacity=".55"/>`;
    const eye = (x) => `<ellipse cx="${x}" cy="44" rx="3.6" ry="4.6" fill="${W}"/><circle cx="${x + 1.2}" cy="42.4" r="1.2" fill="#1d2452"/>`;
    const happyEye = (x) => `<path d="M${x - 4.5} 46 Q${x} 39.5 ${x + 4.5} 46" stroke="${W}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
    const smile = `<path d="M44 52.5 Q50 57.5 56 52.5" stroke="${W}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
    const grin = `<path d="M42.5 51 Q50 61 57.5 51 Z" fill="${W}"/>`;
    let eyes;
    let mouth;
    if (expr === "wow") {
      eyes = `<ellipse cx="40" cy="43.5" rx="4.4" ry="5.6" fill="${W}"/><ellipse cx="60" cy="43.5" rx="4.4" ry="5.6" fill="${W}"/>
              <circle cx="41" cy="42" r="1.5" fill="#1d2452"/><circle cx="61" cy="42" r="1.5" fill="#1d2452"/>`;
      mouth = `<ellipse cx="50" cy="55.5" rx="3.6" ry="4.2" fill="${W}"/>`;
    } else if (expr === "yay") {
      eyes = happyEye(40) + happyEye(60);
      mouth = `<path d="M41.5 50.5 Q50 62.5 58.5 50.5 Z" fill="${W}"/>`;
    } else if (c.face === "wink") {
      eyes = happyEye(40) + eye(60);
      mouth = smile;
    } else {
      eyes = eye(40) + eye(60);
      mouth = c.face === "grin" ? grin : smile;
    }
    const glasses =
      c.acc === "glasses"
        ? `<circle cx="40" cy="44" r="7.5" stroke="${GOLD}" stroke-width="2.2" fill="none"/><circle cx="60" cy="44" r="7.5" stroke="${GOLD}" stroke-width="2.2" fill="none"/><path d="M47.5 44 L52.5 44" stroke="${GOLD}" stroke-width="2.2"/>`
        : "";
    return cheeks + eyes + mouth + glasses;
  }

  function avatarSvg(id, opts) {
    const o = opts || {};
    const c = get(id);
    const size = o.size || 64;
    const expr = o.expr || "default";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -8 100 110" width="${size}" height="${size}">
  ${behind(c)}
  <path d="M19 102 Q19 77 50 77 Q81 77 81 102 Z" fill="${c.suit}" stroke="${INK}" stroke-width="2.5"/>
  <rect x="42" y="84" width="16" height="10" rx="3" fill="#ffffff" opacity=".85"/>
  <circle cx="46.5" cy="89" r="1.8" fill="${GOLD}"/><circle cx="53.5" cy="89" r="1.8" fill="#4cc9f0"/>
  <circle cx="50" cy="44" r="33" fill="#f4f6ff" stroke="${INK}" stroke-width="3"/>
  <ellipse cx="50" cy="76" rx="20" ry="4.5" fill="${c.suit}" stroke="${INK}" stroke-width="2"/>
  <rect x="23" y="26" width="54" height="38" rx="19" fill="#1d2452"/>
  <path d="M30 34 Q36 28 46 28" stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".28"/>
  ${face(c, expr)}
  ${onTop(c)}
</svg>`;
  }

  function characterName(id) {
    return get(id).name;
  }

  function pickFree(taken) {
    const t = taken || [];
    const free = CHARACTERS.filter((c) => !t.includes(c.id));
    const pool = free.length ? free : CHARACTERS;
    return pool[Math.floor(Math.random() * pool.length)].id;
  }

  const API = { CHARACTERS, avatarSvg, characterName, pickFree, suitColor: (id) => get(id).suit };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (typeof window !== "undefined") window.LaunchAvatars = API;
})();
