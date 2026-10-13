// Generates small placeholder sound effects as WAV files (no dependencies).
const fs = require('fs');
const path = require('path');

const RATE = 44100;
const outDir = path.join(__dirname, '..', 'assets', 'samples');

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const buffer = (seconds) => new Array(Math.floor(seconds * RATE)).fill(0);

function addTone(out, startSec, durSec, freq, decay, gain) {
  const start = Math.floor(startSec * RATE);
  for (let i = 0; i < durSec * RATE && start + i < out.length; i++) {
    const t = i / RATE;
    out[start + i] += gain * Math.exp(-decay * t) * (Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(4 * Math.PI * freq * t));
  }
}

function doorbell() {
  const out = buffer(2.2);
  addTone(out, 0, 1.2, 659.25, 3, 0.45);
  addTone(out, 0.6, 1.6, 523.25, 2.5, 0.45);
  return out;
}

function knock() {
  const out = buffer(1.2);
  [0, 0.28, 0.56].forEach((at) => {
    const start = Math.floor(at * RATE);
    for (let i = 0; i < 0.12 * RATE; i++) {
      const t = i / RATE;
      const env = Math.exp(-45 * t);
      out[start + i] += env * (0.7 * Math.sin(2 * Math.PI * 140 * t) + 0.3 * (Math.random() * 2 - 1));
    }
  });
  return out;
}

function beep() {
  const out = buffer(0.5);
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    const fade = Math.min(1, t * 200, (out.length - i) / RATE * 200);
    out[i] = 0.4 * fade * Math.sin(2 * Math.PI * 1000 * t);
  }
  return out;
}

// Loop-friendly: whole number of modulation cycles and a smooth start/end.
function wind() {
  const seconds = 6;
  const out = buffer(seconds);
  let low = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    low += 0.03 * ((Math.random() * 2 - 1) - low);
    const swell = 0.6 + 0.4 * Math.sin(2 * Math.PI * (t / seconds) * 2);
    out[i] = low * 4 * swell * 0.6;
  }
  const fadeLen = Math.floor(0.25 * RATE);
  for (let i = 0; i < fadeLen; i++) {
    const g = i / fadeLen;
    out[i] *= g;
    out[out.length - 1 - i] *= g;
  }
  return out;
}

fs.mkdirSync(outDir, { recursive: true });
const files = { 'doorbell.wav': doorbell(), 'knock.wav': knock(), 'beep.wav': beep(), 'wind.wav': wind() };
for (const [name, samples] of Object.entries(files)) {
  fs.writeFileSync(path.join(outDir, name), wav(samples));
  console.log('wrote', name);
}
