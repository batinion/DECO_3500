// Curated color palette for the post-launch "mission key" reveal.
// Each participant is dealt 2 distinct colors from this list, no repeats within a session.
const PALETTE = [
  { name: "Nebula Pink", hex: "#FF6EC7" },
  { name: "Solar Amber", hex: "#FFB84C" },
  { name: "Comet Teal", hex: "#2EC4B6" },
  { name: "Deep Space Indigo", hex: "#4B3F72" },
  { name: "Meteor Red", hex: "#E63946" },
  { name: "Lunar Silver", hex: "#C9CBCF" },
  { name: "Aurora Green", hex: "#3DDC97" },
  { name: "Stardust Gold", hex: "#F4D35E" },
  { name: "Ion Blue", hex: "#4CC9F0" },
  { name: "Cosmic Violet", hex: "#9B5DE5" },
  { name: "Mars Orange", hex: "#F3722C" },
  { name: "Void Black", hex: "#22223B" },
];

/** Deal `count` distinct random colors from the palette, avoiding any already used in `usedHexes`. */
function dealColors(count, usedHexes = []) {
  const available = PALETTE.filter((c) => !usedHexes.includes(c.hex));
  const pool = [...available];
  const dealt = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    dealt.push(pool.splice(idx, 1)[0]);
  }
  return dealt;
}

module.exports = { PALETTE, dealColors };
