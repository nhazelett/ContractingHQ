/* ─────────────────────────────────────────────────────────────
   Contracting Jeopardy — sound effects
   All effects synthesized via the Web Audio API. No audio files,
   no copyrighted material. Tone + envelope via oscillator nodes.
   ───────────────────────────────────────────────────────────── */
(function () {
  let audioCtx = null;
  let enabled = true;
  let thinkHandle = null;
  let thinkNodes = [];

  function getCtx() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    // Resume after user gesture (browsers suspend until user interacts)
    if (audioCtx.state === 'suspended') {
      try { audioCtx.resume(); } catch (e) { /* ignore */ }
    }
    return audioCtx;
  }

  function tone(freq, duration, opts) {
    if (!enabled) return;
    const ctx = getCtx();
    if (!ctx) return;
    opts = opts || {};
    const type = opts.type || 'sine';
    const gain = opts.gain != null ? opts.gain : 0.18;
    const delay = opts.delay || 0;
    const attack = opts.attack != null ? opts.attack : 0.01;
    const now = ctx.currentTime + delay;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (opts.freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(opts.freqEnd, now + duration);
    }
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function noise(duration, opts) {
    if (!enabled) return;
    const ctx = getCtx();
    if (!ctx) return;
    opts = opts || {};
    const gain = opts.gain != null ? opts.gain : 0.08;
    const delay = opts.delay || 0;
    const now = ctx.currentTime + delay;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(g).connect(ctx.destination);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  const Sounds = {
    enabled: function () { return enabled; },

    setEnabled: function (on) {
      enabled = !!on;
      if (!enabled) Sounds.stopThink();
      try { localStorage.setItem('kthq_jeopardy_sound', enabled ? '1' : '0'); } catch (e) {}
    },

    toggle: function () {
      Sounds.setEnabled(!enabled);
      return enabled;
    },

    // Restore persisted preference (called on load)
    restore: function () {
      try {
        const v = localStorage.getItem('kthq_jeopardy_sound');
        if (v === '0') enabled = false;
      } catch (e) {}
    },

    // Clue selected — short bright ding
    select: function () {
      tone(880, 0.12, { type: 'sine', gain: 0.14 });
      tone(1320, 0.14, { type: 'sine', gain: 0.08, delay: 0.03 });
    },

    // Correct answer — ascending perfect fifth
    correct: function () {
      tone(523.25, 0.14, { type: 'triangle', gain: 0.2 });          // C5
      tone(659.25, 0.14, { type: 'triangle', gain: 0.2, delay: 0.12 }); // E5
      tone(783.99, 0.30, { type: 'triangle', gain: 0.22, delay: 0.24 }); // G5
    },

    // Wrong answer — low descending buzz
    wrong: function () {
      tone(220, 0.25, { type: 'sawtooth', gain: 0.16, freqEnd: 110 });
      noise(0.25, { gain: 0.04 });
    },

    // Daily Double — game-show-style fanfare
    dailyDouble: function () {
      const n = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5 E5 G5 C6 E6
      n.forEach(function (f, i) {
        tone(f, 0.18, { type: 'square', gain: 0.14, delay: i * 0.09 });
      });
      tone(1567.98, 0.5, { type: 'triangle', gain: 0.18, delay: n.length * 0.09 });
    },

    // Time's up — descending three-tone buzz
    timeUp: function () {
      tone(440, 0.18, { type: 'sawtooth', gain: 0.18 });
      tone(330, 0.18, { type: 'sawtooth', gain: 0.18, delay: 0.2 });
      tone(220, 0.35, { type: 'sawtooth', gain: 0.2, delay: 0.4 });
    },

    // Round change — rising chime
    roundChange: function () {
      const n = [392.00, 523.25, 659.25, 783.99]; // G4 C5 E5 G5
      n.forEach(function (f, i) {
        tone(f, 0.22, { type: 'sine', gain: 0.15, delay: i * 0.08 });
      });
    },

    // Game over — short fanfare
    gameOver: function () {
      const n = [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50, 1318.51];
      n.forEach(function (f, i) {
        tone(f, 0.22, { type: 'triangle', gain: 0.2, delay: i * 0.14 });
      });
    },

    // Final Jeopardy countdown loop — tick tock with subtle melody
    // Not the copyrighted "Think" music. Simple evocative ostinato.
    startThink: function () {
      if (!enabled) return;
      Sounds.stopThink();
      const ctx = getCtx();
      if (!ctx) return;
      // Simple 4-note minor arpeggio cycling every second
      const notes = [329.63, 392.00, 493.88, 392.00]; // E4 G4 B4 G4 (E minor arpeggio)
      let i = 0;
      const tick = function () {
        tone(notes[i % notes.length], 0.22, { type: 'sine', gain: 0.1 });
        // faint tick underneath
        tone(1200, 0.04, { type: 'square', gain: 0.04 });
        i++;
      };
      tick();
      thinkHandle = setInterval(tick, 1000);
    },

    stopThink: function () {
      if (thinkHandle) {
        clearInterval(thinkHandle);
        thinkHandle = null;
      }
    }
  };

  Sounds.restore();
  window.Sounds = Sounds;
})();
