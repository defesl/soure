const TRACK_RESOURCE_TYPES = ["stone", "iron", "food", "water", "gold"];
const TRACK_RAW = [
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
  { id: "left-3", domId: "cell-left-3" },
];

let resourceSlotIndex = 0;
export const TRACK = TRACK_RAW.map((cell, index) => {
  const resourceType = TRACK_RESOURCE_TYPES[resourceSlotIndex % TRACK_RESOURCE_TYPES.length];
  resourceSlotIndex += 1;
  return { ...cell, index, type: "resource", resourceType };
});

export const TRACK_LEN = TRACK.length;
