// Consistent SVG line-icon set — one visual language, currentColor-driven, no
// emoji. Each entry is the inner markup of a 24x24 stroke icon; <Ic> (ui.jsx)
// wraps it. Authored here (never user input), so inline markup is safe.

const RANK = '<path d="M12 2 4 5v6c0 4.5 3.2 8.3 8 10 4.8-1.7 8-5.5 8-10V5z"/><path d="m12 8 1.4 2.9 3.1.4-2.3 2.2.6 3.1L12 15.1 9.2 16.6l.6-3.1L7.5 11.3l3.1-.4z" fill="currentColor" stroke="none"/>'

export const ICONS = {
  // pillars / core
  brain: '<path d="M9.5 3A3 3 0 0 0 7 7.5 3.5 3.5 0 0 0 5 11a3.5 3.5 0 0 0 2 3.2A3 3 0 0 0 9.5 20 2.5 2.5 0 0 0 12 17.5V4.5A1.5 1.5 0 0 0 10.5 3z"/><path d="M14.5 3A3 3 0 0 1 17 7.5 3.5 3.5 0 0 1 19 11a3.5 3.5 0 0 1-2 3.2A3 3 0 0 1 14.5 20 2.5 2.5 0 0 1 12 17.5V4.5A1.5 1.5 0 0 1 13.5 3z"/>',
  dumbbell: '<path d="M6.5 8v8M4 9.5v5M17.5 8v8M20 9.5v5M6.5 12h11"/>',
  book: '<path d="M6.5 3H19a1 1 0 0 1 1 1v14.5M6.5 3A2.5 2.5 0 0 0 4 5.5v13A2.5 2.5 0 0 1 6.5 16H20M6.5 3v13"/>',
  // nav
  home: '<path d="M3 10.2 12 3l9 7.2M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M16 8 13.6 13.6 8 16l2.4-5.6z" fill="currentColor" stroke="none"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/>',
  paw: '<circle cx="6.5" cy="11" r="1.8"/><circle cx="9.5" cy="6.5" r="1.8"/><circle cx="14.5" cy="6.5" r="1.8"/><circle cx="17.5" cy="11" r="1.8"/><path d="M8.5 16.5c0-2 1.6-3 3.5-3s3.5 1 3.5 3-1.6 3.5-3.5 3.5-3.5-1.5-3.5-3.5z"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 5H4.5a2 2 0 0 0 0 4H7M17 5h2.5a2 2 0 0 1 0 4H17M9 15.5V18M15 15.5V18M7.5 21h9M9 18h6"/>',
  bag: '<path d="M5 8h14l-1 12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zM9 8V6a3 3 0 0 1 6 0v2"/>',
  // currency / status
  fire: '<path d="M12 3c.5 3 2.5 4.4 4 6 1.4 1.5 2 3.2 2 5a6 6 0 0 1-12 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.4A5 5 0 0 1 12 3z"/>',
  gem: '<path d="M6 3h12l3.5 6-9.5 12L2.5 9z"/><path d="M2.5 9h19M8.5 3 6 9l6 12 6-12-2.5-6"/>',
  bolt: '<path d="M13 2 4 13h7l-1 9 10-12h-7z"/>',
  shield: '<path d="M12 3 5 5.5v6c0 4 2.8 7.4 7 8.8 4.2-1.4 7-4.8 7-8.8v-6z"/>',
  heart: '<path d="M12 20.5C6.5 16.8 3.5 13.5 3.5 9.8A4.3 4.3 0 0 1 12 8a4.3 4.3 0 0 1 8.5 1.8c0 3.7-3 7-8.5 10.7z"/>',
  crown: '<path d="M3 6.5 6.5 16h11L21 6.5l-5 4.5-4-6.5-4 6.5zM6 19h12"/>',
  star: '<path d="m12 3 2.6 5.6 6 .7-4.5 4.2 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7z"/>',
  sparkle: '<path d="M12 3c.6 4 1.8 5.4 6 6-4.2.6-5.4 2-6 6-.6-4-1.8-5.4-6-6 4.2-.6 5.4-2 6-6z"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="M9 14.5 7.5 21l4.5-2.6L16.5 21 15 14.5"/><path d="m12 6 1.1 2.2 2.4.3-1.8 1.7.5 2.4L12 11.6l-2.2 1 .5-2.4-1.8-1.7 2.4-.3z" fill="currentColor" stroke="none"/>',
  medal: '<circle cx="12" cy="14" r="6"/><path d="M8.5 2.5 12 8l3.5-5.5M12 11.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z" fill="currentColor" stroke="none"/><path d="M8.5 2.5 12 8l3.5-5.5" fill="none"/>',
  // actions
  camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  hourglass: '<path d="M6.5 3h11M6.5 21h11M7 3c0 4 3.5 5.2 3.5 9S7 17 7 21M17 3c0 4-3.5 5.2-3.5 9S17 17 17 21"/>',
  pencil: '<path d="M15.5 4.5 19.5 8.5 8 20l-4.5 1L4.5 16.5z"/><path d="m13.5 6.5 4 4"/>',
  bulb: '<path d="M9 18h6M10 21.5h4M8 13.5A5.5 5.5 0 1 1 16 13.5c-.8 1-1.5 1.8-1.5 3v.5h-5v-.5c0-1.2-.7-2-1.5-3z"/>',
  warning: '<path d="M12 4 2.5 20.5h19zM12 10v4.5"/><circle cx="12" cy="17.5" r=".6" fill="currentColor" stroke="none"/>',
  doc: '<path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7zM14 3v4h4M8.5 13h7M8.5 17h5"/>',
  save: '<path d="M6 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8 3v5h7M8 21v-6h8v6"/>',
  trending: '<path d="M3 16.5 9.5 10l3.5 3.5L21 5.5M16 5.5h5v5"/>',
  message: '<path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 4V5z"/>',
  share: '<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.2-4.2"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M4.2 7l2.6 1.5M17.2 15.5l2.6 1.5M19.8 7l-2.6 1.5M6.8 15.5 4.2 17"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/>',
  moon: '<path d="M20.5 13.5A8.5 8.5 0 1 1 10.5 3.5 6.6 6.6 0 0 0 20.5 13.5z"/>',
  trash: '<path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
  // goals / misc
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  rocket: '<path d="M12 3c3 1.5 5 4.5 5 8 0 2-.6 3.7-1.5 5H8.5C7.6 14.7 7 13 7 11c0-3.5 2-6.5 5-8z"/><path d="M9 16c-1.5.5-2.5 1.8-2.5 4 2.2 0 3.5-1 4-2.5M15 16c1.5.5 2.5 1.8 2.5 4-2.2 0-3.5-1-4-2.5"/><circle cx="12" cy="10" r="1.6"/>',
  gradcap: '<path d="M2.5 9 12 5l9.5 4-9.5 4z"/><path d="M6.5 11v4.5c0 1.2 2.5 2.5 5.5 2.5s5.5-1.3 5.5-2.5V11M21.5 9v5"/>',
  shoe: '<path d="M3 15.5V11l4 1 3.5-4 2 3 8 3.5c.8.4 1 1.2 1 2v1H4a1 1 0 0 1-1-1z"/><path d="M7 12v2M10.5 13v2"/>',
  leaf: '<path d="M4 20c-1-8 4-14 16-14 0 12-8 15-14 13"/><path d="M4 20c1.5-4 4-7 8-9"/>',
  sprout: '<path d="M12 20v-8M12 12c0-3.3-2.4-5.5-6-5.5.2 3.5 2.5 5.5 6 5.5zM12 12c0-3.3 2.4-5.5 6-5.5-.2 3.5-2.5 5.5-6 5.5zM8 20h8"/>',
  apple: '<path d="M12 7c-1.3-2-4-2.3-5.5-1C4.8 7.5 4.5 11 6 14c1 2 2 4 3.7 4 1 0 1.3-.5 2.3-.5s1.3.5 2.3.5c1.7 0 2.7-2 3.7-4 1.5-3 1.2-6.5-.5-8-1.5-1.3-4.2-1-5.5 1z"/><path d="M12 7c.3-1.5 1.3-3 3-3.5"/>',
  cake: '<path d="M4 21h16M4 21v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7M4 15c1.6 0 1.6-1.2 3.2-1.2S8.8 15 10.4 15s1.6-1.2 3.2-1.2S15.2 15 16.8 15s1.6-1.2 3.2-1.2M8 12V9M12 12V8.5M16 12V9"/>',
  swords: '<path d="M14.5 3.5 20 3l-.5 5.5-8 8M9.5 3.5 4 3l.5 5.5 8 8M4 20l3-3M20 20l-3-3M14 14l6 6M10 14l-6 6"/>',
  skull: '<path d="M5 10.5A7 7 0 0 1 19 10.5c0 2.3-1 3.7-2 4.8v2.7a1 1 0 0 1-1 1h-1v-2h-2v2h-2v-2H9v2H8a1 1 0 0 1-1-1v-2.7c-1-1.1-2-2.5-2-4.8z"/><circle cx="9" cy="11" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="11" r="1.4" fill="currentColor" stroke="none"/>',
  party: '<path d="M3 21 8 8l8 8zM12 8a4 4 0 0 1 4-4M16 12a4 4 0 0 1 4-4M15 3l.01.01M20 9l.01.01M11 4l.01.01"/>',
  spin: '<path d="M20 11.5A8 8 0 1 0 19 16M20 6v5.5h-5.5"/>',
  // tier rank badges — same shield+star, differentiated by color
  rank1: RANK, rank2: RANK, rank3: RANK, rank4: RANK, rank5: RANK, rank6: RANK, rank7: RANK,
}

export const FALLBACK_ICON = '<circle cx="12" cy="12" r="8"/>'
