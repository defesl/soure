(function () {
  "use strict";
  /**
   * TRACK order must match server/track.js.
   * Clockwise: top row (left→right), corner-tr, right (top→bottom), corner-br,
   * bottom row (right→left), corner-bl, left (bottom→top), corner-tl.
   */
  const TRACK = [
    { id: "top-0", type: "resource", domId: "cell-top-0" },
    { id: "top-1", type: "resource", domId: "cell-top-1" },
    { id: "top-2", type: "resource", domId: "cell-top-2" },
    { id: "top-3", type: "resource", domId: "cell-top-3" },
    { id: "top-4", type: "resource", domId: "cell-top-4" },
    { id: "top-5", type: "resource", domId: "cell-top-5" },
    { id: "top-6", type: "resource", domId: "cell-top-6" },
    { id: "corner-tr", type: "corner", domId: "corner-tr" },
    { id: "right-0", type: "resource", domId: "cell-right-0" },
    { id: "right-1", type: "resource", domId: "cell-right-1" },
    { id: "right-2", type: "resource", domId: "cell-right-2" },
    { id: "right-3", type: "resource", domId: "cell-right-3" },
    { id: "corner-br", type: "corner", domId: "corner-br" },
    { id: "bottom-6", type: "resource", domId: "cell-bottom-6" },
    { id: "bottom-5", type: "resource", domId: "cell-bottom-5" },
    { id: "bottom-4", type: "resource", domId: "cell-bottom-4" },
    { id: "bottom-3", type: "resource", domId: "cell-bottom-3" },
    { id: "bottom-2", type: "resource", domId: "cell-bottom-2" },
    { id: "bottom-1", type: "resource", domId: "cell-bottom-1" },
    { id: "bottom-0", type: "resource", domId: "cell-bottom-0" },
    { id: "corner-bl", type: "corner", domId: "corner-bl" },
    { id: "left-3", type: "resource", domId: "cell-left-3" },
    { id: "left-2", type: "resource", domId: "cell-left-2" },
    { id: "left-1", type: "resource", domId: "cell-left-1" },
    { id: "left-0", type: "resource", domId: "cell-left-0" },
    { id: "corner-tl", type: "corner", domId: "corner-tl" }
  ];
  window.TRACK = TRACK;
  window.TRACK_LEN = TRACK.length;
})();
