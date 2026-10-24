// Launch Sequence — spacecraft sound effects, synthesised live with the Web Audio API.
// No audio files: everything (engine rumble, beeps, chimes, whooshes) is generated here,
// so there's nothing to download or license. Shared by the intro clip (/intro) and the app.
//
//   LaunchSFX.unlock()      call from a tap/click (browsers block sound until then)
//   LaunchSFX.play(name)    "radio" "beep" "ignite" "chime" "lock" "countdown" "liftoff"
//                           "whoosh" "fanfare" "ready" "type" "toast" "load" "warp" "breach"
//                           "alarm" "laser" "hit" "crack" "explode" "rescued" "distress"
//                           "tick" "reveal" "score" ({score: 0-10}) "pop"
//   LaunchSFX.hum(on)       soft cabin drone in the background
//   LaunchSFX.setMuted(b)   / LaunchSFX.muted
(function () {
  let ctx = null;
  let master = null;
  let muted = false;
  let chimeStep = 0;
  let humNodes = null;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.8;
      // gentle limiter so stacked sounds never clip
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      master.connect(comp).connect(ctx.destination);
    }
    return ctx;
  }

  function unlock() {
    const c = ac();
    if (c && c.state === "suspended") c.resume();
  }

  function noiseBuffer(seconds, brown) {
    const c = ac();
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return buf;
  }

  function env(gainNode, t, attack, hold, release, peak) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + attack);
    g.setValueAtTime(peak, t + attack + hold);
    g.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  }

  function tone(freq, { type = "sine", at = 0, dur = 0.15, peak = 0.3, attack = 0.005, glideTo = null } = {}) {
    const c = ac();
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    env(g, t, attack, dur * 0.3, dur * 0.7, peak);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  function noise({ at = 0, dur = 0.5, peak = 0.4, filter = "lowpass", from = 800, to = null, q = 1, brown = false, attack = 0.02 } = {}) {
    const c = ac();
    const t = c.currentTime + at;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(dur + 0.2, brown);
    const f = c.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain();
    env(g, t, attack, dur * 0.4, dur * 0.6, peak);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.2);
  }

  const SOUNDS = {
    // mission-control radio: static crackle + two beeps
    radio() {
      noise({ dur: 0.18, peak: 0.12, filter: "bandpass", from: 2500, q: 3 });
      tone(1250, { type: "sine", at: 0.12, dur: 0.09, peak: 0.18 });
      tone(1250, { type: "sine", at: 0.28, dur: 0.09, peak: 0.18 });
      noise({ at: 0.4, dur: 0.12, peak: 0.08, filter: "bandpass", from: 3000, q: 4 });
    },
    beep() {
      tone(880, { type: "square", dur: 0.08, peak: 0.08 });
    },
    // one engine lighting: a deep "fwoomp"
    ignite() {
      noise({ dur: 0.9, peak: 0.55, filter: "lowpass", from: 2200, to: 180, brown: true, attack: 0.01 });
      tone(90, { type: "sine", dur: 0.5, peak: 0.45, glideTo: 45 });
      noise({ dur: 0.25, peak: 0.12, filter: "highpass", from: 3000 });
    },
    // a memory dropping into the capsule — each one a step higher
    chime() {
      const scale = [659.25, 783.99, 880, 987.77, 1174.66, 1318.51];
      const f = scale[chimeStep++ % scale.length];
      tone(f, { type: "sine", dur: 0.9, peak: 0.22, attack: 0.003 });
      tone(f * 2, { type: "sine", dur: 0.6, peak: 0.07, attack: 0.003 });
      tone(f * 3.01, { type: "triangle", dur: 0.35, peak: 0.03, attack: 0.003 });
    },
    // the capsule locking: metallic click + thud
    lock() {
      noise({ dur: 0.05, peak: 0.35, filter: "highpass", from: 4000 });
      tone(1800, { type: "square", dur: 0.03, peak: 0.08 });
      tone(120, { type: "sine", at: 0.06, dur: 0.25, peak: 0.4, glideTo: 70 });
      noise({ at: 0.06, dur: 0.2, peak: 0.15, filter: "lowpass", from: 400 });
    },
    // a bright notification bell: "cling-cling"
    bell() {
      [0, 0.32].forEach((at) => {
        tone(1568, { type: "sine", at, dur: 1.1, peak: 0.22, attack: 0.002 });
        tone(2349, { type: "sine", at, dur: 0.8, peak: 0.12, attack: 0.002 });
        tone(3136, { type: "sine", at, dur: 0.5, peak: 0.07, attack: 0.002 });
        tone(4186, { type: "triangle", at, dur: 0.25, peak: 0.03, attack: 0.002 });
      });
    },
    ready() {
      tone(660, { type: "triangle", dur: 0.1, peak: 0.15 });
      tone(990, { type: "triangle", at: 0.1, dur: 0.18, peak: 0.15 });
    },
    // 3… 2… 1… (call once per number; pass {final:true} for "liftoff")
    countdown(opts) {
      if (opts && opts.final) tone(1320, { type: "square", dur: 0.5, peak: 0.12 });
      else tone(880, { type: "square", dur: 0.14, peak: 0.1 });
    },
    // full launch: rumble builds, roars, then fades as the rocket leaves
    liftoff() {
      noise({ dur: 6.5, peak: 0.85, filter: "lowpass", from: 120, to: 900, brown: true, attack: 1.2 });
      noise({ at: 1.0, dur: 4.5, peak: 0.25, filter: "bandpass", from: 300, to: 2400, q: 0.8, attack: 0.8 });
      tone(55, { type: "sawtooth", dur: 5, peak: 0.12, attack: 1, glideTo: 80 });
      tone(41, { type: "sine", dur: 5.5, peak: 0.35, attack: 0.8 });
    },
    // the engines winding down in deep space: the rumble drifts away slowly and is gone before the next scene
    cruise() {
      noise({ dur: 5.8, peak: 0.3, filter: "lowpass", from: 700, to: 90, brown: true, attack: 0.25 });
      tone(48, { type: "sine", dur: 5.6, peak: 0.22, attack: 0.25, glideTo: 30 });
      tone(96, { type: "sawtooth", dur: 4.8, peak: 0.04, attack: 0.25, glideTo: 50 });
    },
    whoosh() {
      noise({ dur: 1.6, peak: 0.4, filter: "bandpass", from: 3500, to: 250, q: 1.2, attack: 0.25 });
    },
    // the capsule opening
    fanfare() {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => {
        tone(f, { type: "triangle", at: i * 0.12, dur: 0.6, peak: 0.16 });
        tone(f / 2, { type: "sine", at: i * 0.12, dur: 0.6, peak: 0.08 });
      });
      tone(1046.5, { type: "sine", at: 0.5, dur: 1.6, peak: 0.14 });
      tone(1567.98, { type: "sine", at: 0.5, dur: 1.4, peak: 0.06 });
    },
    // typewriter tick for text being filled in
    type() {
      noise({ dur: 0.025, peak: 0.08, filter: "bandpass", from: 2800 + Math.random() * 800, q: 6, attack: 0.002 });
    },
    toast() {
      tone(1046.5, { type: "sine", dur: 0.12, peak: 0.12 });
      tone(1396.9, { type: "sine", at: 0.08, dur: 0.2, peak: 0.1 });
    },
    // a crewmate slides their memory capsule into the cargo hold: hydraulic hiss + clunk
    load() {
      noise({ dur: 0.35, peak: 0.12, filter: "highpass", from: 2500, to: 6000, attack: 0.04 });
      tone(180, { type: "sine", at: 0.28, dur: 0.18, peak: 0.35, glideTo: 90 });
      noise({ at: 0.28, dur: 0.08, peak: 0.2, filter: "lowpass", from: 600 });
    },
    // the time warp: a long rising tunnel roar with a shimmer on top
    warp() {
      noise({ dur: 8.5, peak: 0.45, filter: "bandpass", from: 180, to: 2600, q: 0.7, attack: 1.4 });
      tone(70, { type: "sawtooth", dur: 8, peak: 0.07, attack: 1.5, glideTo: 220 });
      tone(880, { type: "sine", at: 1, dur: 7, peak: 0.03, attack: 2, glideTo: 1760 });
      noise({ at: 8.2, dur: 1.2, peak: 0.35, filter: "bandpass", from: 3000, to: 200, q: 1.2, attack: 0.05 });
    },
    // the cargo hatch blowing open: bang, hiss of air, then the alarm
    breach() {
      noise({ dur: 0.9, peak: 0.9, filter: "lowpass", from: 3000, to: 120, brown: true, attack: 0.005 });
      tone(65, { type: "sine", dur: 0.7, peak: 0.6, glideTo: 30 });
      noise({ at: 0.15, dur: 2.2, peak: 0.25, filter: "highpass", from: 1800, to: 900, attack: 0.05 });
      [0.6, 1.4, 2.2].forEach((at) => SOUNDS.alarm({ at }));
    },
    alarm(opts) {
      const at = (opts && opts.at) || 0;
      tone(740, { type: "square", at, dur: 0.32, peak: 0.07, glideTo: 520 });
      tone(740, { type: "square", at: at + 0.38, dur: 0.32, peak: 0.07, glideTo: 520 });
    },
    laser() {
      tone(1500 + Math.random() * 300, { type: "square", dur: 0.09, peak: 0.035, glideTo: 380 });
    },
    hit() {
      noise({ dur: 0.07, peak: 0.12, filter: "bandpass", from: 900 + Math.random() * 500, q: 2, attack: 0.002 });
    },
    // a chunk of asteroid breaks away
    crack() {
      noise({ dur: 0.3, peak: 0.3, filter: "lowpass", from: 1600, to: 200, brown: true, attack: 0.003 });
      tone(140, { type: "triangle", dur: 0.15, peak: 0.15, glideTo: 70 });
    },
    // a Forgetter (alien) zapped
    explode() {
      noise({ dur: 0.45, peak: 0.35, filter: "lowpass", from: 2400, to: 150, attack: 0.003 });
      tone(320, { type: "square", dur: 0.2, peak: 0.06, glideTo: 60 });
    },
    // a capsule saved: sparkly rising arpeggio
    rescued() {
      [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => tone(f, { type: "triangle", at: i * 0.07, dur: 0.5, peak: 0.13 }));
      tone(2093, { type: "sine", at: 0.3, dur: 0.9, peak: 0.05 });
    },
    // someone's capsule needs the crew
    distress() {
      tone(988, { type: "square", dur: 0.12, peak: 0.07 });
      tone(784, { type: "square", at: 0.15, dur: 0.12, peak: 0.07 });
      tone(988, { type: "square", at: 0.3, dur: 0.12, peak: 0.07 });
      noise({ at: 0.45, dur: 0.15, peak: 0.08, filter: "bandpass", from: 2500, q: 3 });
    },
    tick() {
      tone(1800, { type: "sine", dur: 0.03, peak: 0.06 });
    },
    // a colour is flashed on screen
    reveal() {
      tone(523.25, { type: "sine", dur: 0.7, peak: 0.12 });
      tone(659.25, { type: "sine", at: 0.05, dur: 0.7, peak: 0.1 });
      tone(783.99, { type: "sine", at: 0.1, dur: 0.8, peak: 0.08 });
    },
    // colour game result: the closer you got, the higher and longer it rings
    score(opts) {
      const s = Math.max(0, Math.min(10, (opts && opts.score) || 0));
      const steps = 2 + Math.round(s / 2);
      const scale = [392, 440, 523.25, 587.33, 659.25, 783.99, 880];
      for (let i = 0; i < steps; i++) tone(scale[i], { type: "triangle", at: i * 0.08, dur: 0.35, peak: 0.12 });
    },
    pop() {
      tone(600, { type: "sine", dur: 0.08, peak: 0.15, glideTo: 1200 });
    },
  };

  function play(name, opts) {
    const c = ac();
    if (!c || muted || !SOUNDS[name]) return;
    if (c.state === "suspended") c.resume();
    try {
      SOUNDS[name](opts);
    } catch (e) {
      /* never let a sound break the page */
    }
  }

  // soft cabin drone: two detuned low tones + airy noise
  function hum(on) {
    const c = ac();
    if (!c) return;
    if (on && !humNodes) {
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.09, c.currentTime + 2);
      const o1 = c.createOscillator();
      const o2 = c.createOscillator();
      o1.frequency.value = 55;
      o2.frequency.value = 55.6;
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(4, true);
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 350;
      const ng = c.createGain();
      ng.gain.value = 0.5;
      o1.connect(g);
      o2.connect(g);
      src.connect(f).connect(ng).connect(g);
      g.connect(master);
      [o1, o2, src].forEach((n) => n.start());
      humNodes = { g, nodes: [o1, o2, src] };
    } else if (!on && humNodes) {
      const { g, nodes } = humNodes;
      humNodes = null;
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.8);
      nodes.forEach((n) => n.stop(c.currentTime + 0.9));
    }
  }

  function setMuted(m) {
    muted = !!m;
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.05);
  }

  window.LaunchSFX = {
    unlock,
    play,
    hum,
    setMuted,
    get muted() {
      return muted;
    },
  };
})();
