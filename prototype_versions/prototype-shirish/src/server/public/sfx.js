// Launch Sequence — spacecraft sound effects, synthesised live with the Web Audio API.
// No audio files: everything (engine rumble, beeps, chimes, whooshes) is generated here,
// so there's nothing to download or license. Shared by the intro clip (/intro) and the app.
//
//   LaunchSFX.unlock()      call from a tap/click (browsers block sound until then)
//   LaunchSFX.play(name)    "radio" "beep" "ignite" "chime" "lock" "countdown" "liftoff"
//                           "whoosh" "fanfare" "ready" "type" "toast"
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
