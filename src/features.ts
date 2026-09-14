import { clamp } from "./weights.js";
import type { MacroFeat } from "./types.js";

export function writeMacro(feat: Float32Array, m: MacroFeat): void {
  feat[24] = clamp(m.dominance, 0, 1);
  feat[25] = clamp(m.leaderDelta / 4, 0, 1);
  feat[26] = clamp(m.myShare, 0, 1);
  feat[27] = clamp(m.rivalFriction, 0, 1);
  feat[28] = clamp(m.pressureOnMe, 0, 1);
  feat[29] = m.targetIsLeader;
  feat[30] = clamp(m.buffer, 0, 1);
  feat[31] = clamp(m.dump, 0, 1);
}

export function writeSendFeatures(
  feat: Float32Array,
  fromEnergy: number,
  toEnergy: number,
  dist: number,
  owner: number,
  toOwner: number,
  outgoingFrom: number,
  incomingFrom: number,
  incomingTo: number,
  myCells: number,
  myEnergy: number,
  time: number,
  aimedAtTo: number,
  nearbyRivals: number,
  reach: number,
  tentacleSlots: number,
  toOccupancyMine: number,
  toCaptureNeed: number,
  macro: MacroFeat,
): void {
  const mine = +(toOwner === owner);
  const rival = +(toOwner !== owner && toOwner !== 0);
  feat[0] = fromEnergy / 200;
  feat[1] = toEnergy / 200;
  feat[2] = dist / 720;
  feat[3] = clamp((reach - dist) / 400, -1, 1);
  feat[4] = mine;
  feat[5] = rival;
  feat[6] = +(toOwner === 0);
  feat[7] = Math.min(1, outgoingFrom / 3);
  feat[8] = Math.min(1, incomingFrom / 3);
  feat[9] = Math.min(1, incomingTo / 3);
  feat[10] = clamp((fromEnergy - toEnergy) / 200, -1, 1);
  feat[11] = Math.min(1, myCells / 8);
  feat[12] = Math.min(1, myEnergy / 800);
  feat[13] = toOwner === 0 ? Math.min(1, toOccupancyMine / Math.max(1, toCaptureNeed)) : 0;
  feat[14] = Math.min(1, dist / 14 / Math.max(4, fromEnergy));
  feat[15] = Math.min(1, time / 90);
  feat[16] = Math.min(1, incomingFrom / 2);
  feat[17] = Math.min(1, incomingTo / 2);
  feat[18] = mine && incomingTo === 0 ? toEnergy / 200 : 0;
  feat[19] = Math.min(1, aimedAtTo / 3);
  feat[20] = clamp((tentacleSlots - outgoingFrom) / 3, 0, 1);
  feat[21] = rival;
  feat[22] = +(nearbyRivals > 0);
  feat[23] =
    mine
      ? Math.min(1, ((200 - toEnergy) / 200) * +(incomingTo > 0))
      : toOwner === 0
        ? 0.55
        : clamp((fromEnergy - toEnergy) / 200, -1, 1);
  writeMacro(feat, macro);
}

export function writeCutFeatures(
  feat: Float32Array,
  tentCharge: number,
  tentProgress: number,
  tentState: string,
  lockT: number,
  fromEnergy: number,
  toEnergy: number,
  owner: number,
  toOwner: number,
  incomingFrom: number,
  incomingTo: number,
  myCells: number,
  myEnergy: number,
  time: number,
  aimedAtTo: number,
  freeSlots: number,
  cutT: number,
  packetN: number,
  stall: number,
  macro: MacroFeat,
): void {
  const dumpReady = +(toOwner === owner && toEnergy >= 160 && incomingTo === 0);
  feat[0] = fromEnergy / 200;
  feat[1] = toEnergy / 200;
  feat[2] = Math.min(1, tentCharge / 200);
  feat[3] = tentProgress;
  feat[4] = +(tentState === "locked");
  feat[5] = lockT;
  feat[6] = +(toOwner !== owner && toOwner !== 0);
  feat[7] = +(toOwner === owner);
  feat[8] = Math.min(1, incomingFrom / 3);
  feat[9] = +(fromEnergy < 12);
  feat[10] = +(tentCharge + 2 >= toEnergy && toOwner !== owner);
  feat[11] = Math.min(1, packetN / 8);
  feat[12] = Math.min(1, stall / 0.55);
  feat[13] = Math.min(1, myCells / 8);
  feat[14] = Math.min(1, myEnergy / 800);
  feat[15] = Math.min(1, time / 90);
  feat[16] = dumpReady;
  feat[17] = Math.min(1, incomingFrom / 2);
  feat[18] = +(tentState === "locked" && toOwner !== owner && toOwner !== 0);
  feat[19] = Math.min(1, aimedAtTo / 3);
  feat[20] = clamp(freeSlots / 3, 0, 1);
  feat[21] = +(tentState === "growing" && fromEnergy < 12);
  feat[22] = Math.min(1, incomingTo / 2);
  feat[23] = clamp(cutT, 0, 1);
  writeMacro(feat, macro);
}
