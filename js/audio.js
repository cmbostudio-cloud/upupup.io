(() => {
  const AudioCtor = window.AudioContext || window.webkitAudioContext || null;
  let audioManager = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function createAudioManager(initialVolume = 1) {
    if (audioManager) {
      audioManager.setVolume(initialVolume);
      return audioManager;
    }

    let ac = null;
    let masterGain = null;
    let volume = clamp(Number.isFinite(initialVolume) ? initialVolume : 1, 0, 1);
    let lastImpactAt = 0;
    let lastImpactSource = '';
    let lastImpactStrength = 0;
    let impactMutedUntil = 0;

    function ensureContext() {
      if (!AudioCtor) return null;
      if (!ac) {
        ac = new AudioCtor();
        masterGain = ac.createGain();
        masterGain.gain.value = volume;
        masterGain.connect(ac.destination);
      }
      return ac;
    }

    function setVolume(nextVolume) {
      volume = clamp(Number.isFinite(nextVolume) ? nextVolume : volume, 0, 1);
      if (masterGain && ac) {
        masterGain.gain.setTargetAtTime(volume, ac.currentTime, 0.01);
      }
    }

    function unlock() {
      const ctx = ensureContext();
      if (!ctx) return false;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => undefined);
      }
      return true;
    }

    function suppressImpactsFor(ms = 0) {
      const duration = Math.max(0, Number(ms) || 0);
      const now = typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
      impactMutedUntil = Math.max(impactMutedUntil, now + duration);
    }

    function playTone({
      type = 'sine',
      frequencies = [440],
      duration = 0.12,
      gain = 0.14,
      attack = 0.004,
      release = 0.02,
      spacing = 0.075,
      startOffset = 0,
      envelope = 'exp',
    } = {}) {
      const ctx = ensureContext();
      if (!ctx || !masterGain) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => undefined);
      }

      const startTime = ctx.currentTime + startOffset;
      frequencies.forEach((frequency, index) => {
        const osc = ctx.createOscillator();
        const amp = ctx.createGain();
        osc.type = type;
        osc.frequency.value = frequency;
        osc.connect(amp);
        amp.connect(masterGain);

        const t = startTime + index * spacing;
        const attackEnd = t + attack;
        const stopTime = t + duration;

        amp.gain.setValueAtTime(0.0001, t);
        amp.gain.linearRampToValueAtTime(gain, attackEnd);
        if (envelope === 'exp') {
          amp.gain.exponentialRampToValueAtTime(0.001, stopTime);
        } else {
          amp.gain.linearRampToValueAtTime(0.001, stopTime);
        }
        osc.start(t);
        osc.stop(stopTime + release);
      });
    }

    function playPlatformLand(impact = {}) {
      const data = typeof impact === 'number' ? { strength: impact } : (impact || {});
      const strength = clamp(Number.isFinite(data.strength) ? data.strength : 0, 0, 3);
      const source = data.source ?? data.kind ?? 'impact';
      const now = typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
      if (now < impactMutedUntil) return;
      const cooldownMs = 90;
      if (
        now - lastImpactAt < cooldownMs &&
        source === lastImpactSource &&
        strength <= lastImpactStrength + 0.15
      ) {
        return;
      }
      lastImpactAt = now;
      lastImpactSource = source;
      lastImpactStrength = strength;

      const playback = ensureContext();
      if (!playback || !masterGain) return;
      if (playback.state === 'suspended') {
        playback.resume().catch(() => undefined);
      }

      // Layer 1: plank resonance
      const osc = playback.createOscillator();
      const gOsc = playback.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140 + strength * 18, playback.currentTime);
      osc.frequency.exponentialRampToValueAtTime(55, playback.currentTime + 0.12);
      gOsc.gain.setValueAtTime(0.55, playback.currentTime);
      gOsc.gain.exponentialRampToValueAtTime(0.001, playback.currentTime + 0.18);
      osc.connect(gOsc);
      gOsc.connect(masterGain);
      osc.start();
      osc.stop(playback.currentTime + 0.18);

      // Layer 2: impact noise
      const bufLen = Math.floor(playback.sampleRate * 0.15);
      const buf = playback.createBuffer(1, bufLen, playback.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (playback.sampleRate * 0.025));
      }
      const src = playback.createBufferSource();
      src.buffer = buf;
      const lp = playback.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 260 + strength * 35;
      const gN = playback.createGain();
      gN.gain.setValueAtTime(0.8, playback.currentTime);
      gN.gain.exponentialRampToValueAtTime(0.001, playback.currentTime + 0.15);
      src.connect(lp);
      lp.connect(gN);
      gN.connect(masterGain);
      src.start();

      // Layer 3: surface friction
      const bufLen2 = Math.floor(playback.sampleRate * 0.06);
      const buf2 = playback.createBuffer(1, bufLen2, playback.sampleRate);
      const d2 = buf2.getChannelData(0);
      for (let i = 0; i < bufLen2; i++) {
        d2[i] = (Math.random() * 2 - 1) * Math.exp(-i / (playback.sampleRate * 0.02));
      }
      const src2 = playback.createBufferSource();
      src2.buffer = buf2;
      const bp = playback.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1200;
      bp.Q.value = 1.5;
      const gS = playback.createGain();
      gS.gain.setValueAtTime(0.15, playback.currentTime + 0.02);
      gS.gain.exponentialRampToValueAtTime(0.001, playback.currentTime + 0.08);
      src2.connect(bp);
      bp.connect(gS);
      gS.connect(masterGain);
      src2.start(playback.currentTime + 0.02);
    }

    function playTabNext() {
      const ctx = ensureContext();
      if (!ctx || !masterGain) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => undefined);
      }

      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.connect(amp);
      amp.connect(masterGain);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(560, ctx.currentTime + 0.09);
      amp.gain.setValueAtTime(0.0001, ctx.currentTime);
      amp.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.01);
      amp.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    }

    function playTabPrev() {
      const ctx = ensureContext();
      if (!ctx || !masterGain) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => undefined);
      }

      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.connect(amp);
      amp.connect(masterGain);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(560, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.09);
      amp.gain.setValueAtTime(0.0001, ctx.currentTime);
      amp.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.01);
      amp.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    }

    function playCredit() {
      const ctx = ensureContext();
      if (!ctx || !masterGain) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => undefined);
      }

      [660, 990].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const amp = ctx.createGain();
        osc.connect(amp);
        amp.connect(masterGain);
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.075;
        amp.gain.setValueAtTime(0.0001, t);
        amp.gain.setValueAtTime(0.22, t);
        amp.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.start(t);
        osc.stop(t + 0.2);
      });
    }

    function playStarCollect() {
      playTone({
        type: 'triangle',
        frequencies: [784, 988, 1175],
        duration: 0.06,
        gain: 0.11,
        attack: 0.002,
        spacing: 0.035,
        envelope: 'exp',
      });
    }

    audioManager = {
      unlock,
      suppressImpactsFor,
      setVolume,
      playImpact: playPlatformLand,
      playPlatformLand,
      playCollect: playCredit,
      playCredit,
      playStarCollect,
      playTabNext,
      playTabPrev,
      playStartSwoosh() {
        playTone({
          type: 'triangle',
          frequencies: [330, 495],
          duration: 0.09,
          gain: 0.12,
          attack: 0.003,
          spacing: 0.06,
        });
      },
    };

    return audioManager;
  }

  function getAudioManager() {
    return audioManager;
  }

  window.UpUpUpAudio = {
    createAudioManager,
    getAudioManager,
  };
})();
