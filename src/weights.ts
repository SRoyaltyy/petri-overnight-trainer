import { HEAD_SIZE, WEIGHT_COUNT } from "./types.js";
import type { Net } from "./types.js";

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function relu(v: number): number {
  return v > 0 ? v : 0;
}

export function randomNet(scale = 0.08): Net {
  const w = new Float32Array(WEIGHT_COUNT);
  for (let i = 0; i < w.length; i++) w[i] = (Math.random() * 2 - 1) * scale;
  w[272] = 0.07;
  w[545] = 0.06;
  return { w };
}

export function cloneNet(net: Net): Net {
  return { w: new Float32Array(net.w) };
}

export function mutateNet(net: Net, scale: number, rate: number): Net {
  const out = cloneNet(net);
  for (let i = 0; i < out.w.length; i++) {
    if (Math.random() < rate) out.w[i] += (Math.random() * 2 - 1) * scale;
  }
  return out;
}

export function crossoverNet(a: Net, b: Net): Net {
  const out = cloneNet(a);
  const mix = 0.35 + Math.random() * 0.3;
  for (let i = 0; i < out.w.length; i++) {
    out.w[i] = a.w[i] * mix + b.w[i] * (1 - mix);
  }
  return out;
}

export function encodeWeights(w: Float32Array | number[]): string {
  const arr = w instanceof Float32Array ? w : Float32Array.from(w);
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength).toString("base64");
}

export function decodeWeights(raw: string | number[] | Float32Array): Float32Array {
  if (raw instanceof Float32Array) {
    if (raw.length === WEIGHT_COUNT) return raw;
    const padded = new Float32Array(WEIGHT_COUNT);
    padded.set(raw.subarray(0, Math.min(raw.length, WEIGHT_COUNT)));
    return padded;
  }
  if (Array.isArray(raw)) {
    const arr = Float32Array.from(raw);
    if (arr.length === WEIGHT_COUNT) return arr;
    const padded = new Float32Array(WEIGHT_COUNT);
    padded.set(arr.subarray(0, Math.min(arr.length, WEIGHT_COUNT)));
    return padded;
  }
  const buf = Buffer.from(raw, "base64");
  const copy = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const floats = new Float32Array(copy);
  if (floats.length === WEIGHT_COUNT) return floats;
  const padded = new Float32Array(WEIGHT_COUNT);
  padded.set(floats.subarray(0, Math.min(floats.length, WEIGHT_COUNT)));
  return padded;
}

export function netFromWeights(raw: string | number[] | Float32Array): Net {
  return { w: decodeWeights(raw) };
}

const hidden = new Float32Array(8);

function hiddenLayer(w: Float32Array, offset: number, feat: Float32Array): void {
  for (let r = 0; r < 8; r++) {
    let sum = w[offset + 256 + r];
    const row = offset + r * 32;
    for (let i = 0; i < 32; i++) sum += w[row + i] * feat[i];
    hidden[r] = relu(sum);
  }
}

export function scoreSend(net: Net, feat: Float32Array): number {
  const w = net.w;
  hiddenLayer(w, 0, feat);
  let y = w[272];
  for (let i = 0; i < 8; i++) y += w[264 + i] * hidden[i];
  return y;
}

export function scoreCut(net: Net, feat: Float32Array): number {
  const w = net.w;
  hiddenLayer(w, HEAD_SIZE, feat);
  let y = w[545];
  for (let i = 0; i < 8; i++) y += w[537 + i] * hidden[i];
  return y;
}

export function mutationScale(gen: number): number {
  return 0.12 * (0.4 + 0.6 / (1 + gen / 60));
}
