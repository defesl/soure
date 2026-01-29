"use strict";

/**
 * Resource types for track slots (must match gameEngine RESOURCE_TYPES).
 * Used to assign resourceType to each resource slot on the perimeter track.
 */
const TRACK_RESOURCE_TYPES = ["stone", "iron", "food", "water", "gold"];

const CORNER_IDS = ["TL", "TR", "BR", "BL"];

const CORNER_FIELDS = [
  { kind: "corner", cornerId: "TL", domId: "corner-tl" },
  { kind: "corner", cornerId: "TR", domId: "corner-tr" },
  { kind: "corner", cornerId: "BR", domId: "corner-br" },
  { kind: "corner", cornerId: "BL", domId: "corner-bl" }
];

/**
 * Canonical ordered list of resource tiles on the perimeter track (clockwise).
 * Order: top row (left→right), right side (top→bottom),
 * bottom row (right→left), left side (bottom→top).
 */
const RESOURCE_FIELDS_RAW = [
  { id: "top-0", domId: "cell-top-0" },
  { id: "top-1", domId: "cell-top-1" },
  { id: "top-2", domId: "cell-top-2" },
  { id: "top-3", domId: "cell-top-3" },
  { id: "top-4", domId: "cell-top-4" },
  { id: "top-5", domId: "cell-top-5" },
  { id: "top-6", domId: "cell-top-6" },
  { id: "right-0", domId: "cell-right-0" },
  { id: "right-1", domId: "cell-right-1" },
  { id: "right-2", domId: "cell-right-2" },
  { id: "right-3", domId: "cell-right-3" },
  { id: "bottom-6", domId: "cell-bottom-6" },
  { id: "bottom-5", domId: "cell-bottom-5" },
  { id: "bottom-4", domId: "cell-bottom-4" },
  { id: "bottom-3", domId: "cell-bottom-3" },
  { id: "bottom-2", domId: "cell-bottom-2" },
  { id: "bottom-1", domId: "cell-bottom-1" },
  { id: "bottom-0", domId: "cell-bottom-0" },
  { id: "left-0", domId: "cell-left-0" },
  { id: "left-1", domId: "cell-left-1" },
  { id: "left-2", domId: "cell-left-2" },
  { id: "left-3", domId: "cell-left-3" }
];

let resourceSlotIndex = 0;
const RESOURCE_FIELDS = RESOURCE_FIELDS_RAW.map((cell) => {
  const resourceType = TRACK_RESOURCE_TYPES[resourceSlotIndex % TRACK_RESOURCE_TYPES.length];
  resourceSlotIndex += 1;
  return { kind: "resource", resourceType, ...cell };
});

const TRACK_FIELDS = [
  CORNER_FIELDS[0],
  ...RESOURCE_FIELDS.slice(0, 7),
  CORNER_FIELDS[1],
  ...RESOURCE_FIELDS.slice(7, 11),
  CORNER_FIELDS[2],
  ...RESOURCE_FIELDS.slice(11, 18),
  CORNER_FIELDS[3],
  ...RESOURCE_FIELDS.slice(18, 22)
].map((field, index) => ({ index, ...field }));

const TRACK_LEN = TRACK_FIELDS.length;

const CORNER_INDEX_BY_ID = TRACK_FIELDS.reduce((acc, field) => {
  if (field.kind === "corner") acc[field.cornerId] = field.index;
  return acc;
}, {});

/** Predefined player colors (no duplicates for first 4 players). */
const TOKEN_PALETTE = ["#ef4444", "#22c55e", "#38bdf8", "#facc15"];

module.exports = {
  TRACK_FIELDS,
  TRACK_LEN,
  TOKEN_PALETTE,
  CORNER_IDS,
  CORNER_INDEX_BY_ID
};
