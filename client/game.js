(function () {
  "use strict";

  const RESOURCES = ["stone", "iron", "food", "water", "gold"];

  let user = null;
  let socket = null;
  let state = null;
  const REJOIN_STORAGE_KEY = "rejoinGameId";
  /**
   * Reconnect flow / lastGameId:
   * - lastGameId is stored in localStorage (key LAST_GAME_ID_KEY) when: create game success, join game success, or gameState received with phase !== "lobby".
   * - Main menu shows "Reconnect" button only when GET /api/active-game returns ok + gameId (server validates game exists and user is a member).
   * - Clicking Reconnect navigates to /play/{gameId}; play page uses rejoinGame socket to rejoin. Cleared when game ends (clearRejoinGameId).
   */
  const LAST_GAME_ID_KEY = "lastGameId";

  const $ = (id) => document.getElementById(id);
  const DEBUG_BADGE_ID = "trackDebugBadge";
  const DEBUG_STYLE_ID = "trackDebugStyle";
  const DEBUG_INVALID_ID = "trackInvalidWarning";
  const DEBUG_CORNER_INVALID_ID = "cornerInvalidWarning";
  const LANDED_HIGHLIGHT_CLASS = "landed-highlight";

  function isDebugUI() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("debug") === "1") return true;
      return localStorage.getItem("DEBUG_UI") === "1";
    } catch (_) {
      return false;
    }
  }

  function ensureDebugStyles() {
    if (document.getElementById(DEBUG_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = DEBUG_STYLE_ID;
    style.textContent = `
      .${LANDED_HIGHLIGHT_CLASS} {
        outline: 2px solid var(--accent);
        box-shadow: 0 0 12px var(--accent-glow-strong);
      }
      .debug-ui-hidden {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureDebugWarning() {
    let el = document.getElementById(DEBUG_INVALID_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = DEBUG_INVALID_ID;
      el.style.position = "fixed";
      el.style.top = "8px";
      el.style.left = "8px";
      el.style.zIndex = "9999";
      el.style.padding = "6px 10px";
      el.style.background = "rgba(239, 68, 68, 0.2)";
      el.style.border = "1px solid rgba(239, 68, 68, 0.5)";
      el.style.color = "#fca5a5";
      el.style.fontSize = "12px";
      el.style.borderRadius = "8px";
      el.style.display = "none";
      el.classList.add("debug-ui");
      if (!isDebugUI()) el.classList.add("debug-ui-hidden");
      el.textContent = "TRACK INVALID";
      document.body.appendChild(el);
    }
    return el;
  }

  function setDebugWarningVisible(visible) {
    if (!isDebugUI()) return;
    const el = ensureDebugWarning();
    el.style.display = visible ? "block" : "none";
  }

  function ensureCornerDebugWarning() {
    let el = document.getElementById(DEBUG_CORNER_INVALID_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = DEBUG_CORNER_INVALID_ID;
      el.style.position = "fixed";
      el.style.top = "32px";
      el.style.left = "8px";
      el.style.zIndex = "9999";
      el.style.padding = "6px 10px";
      el.style.background = "rgba(239, 68, 68, 0.2)";
      el.style.border = "1px solid rgba(239, 68, 68, 0.5)";
      el.style.color = "#fca5a5";
      el.style.fontSize = "12px";
      el.style.borderRadius = "8px";
      el.style.display = "none";
      el.classList.add("debug-ui");
      if (!isDebugUI()) el.classList.add("debug-ui-hidden");
      el.textContent = "CORNER INVALID";
      document.body.appendChild(el);
    }
    return el;
  }

  function setCornerDebugWarningVisible(visible) {
    if (!isDebugUI()) return;
    const el = ensureCornerDebugWarning();
    el.style.display = visible ? "block" : "none";
  }

  function ensureDebugBadge() {
    let el = document.getElementById(DEBUG_BADGE_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = DEBUG_BADGE_ID;
      el.style.position = "fixed";
      el.style.top = "40px";
      el.style.left = "8px";
      el.style.zIndex = "9999";
      el.style.padding = "6px 10px";
      el.style.background = "rgba(0, 0, 0, 0.6)";
      el.style.border = "1px solid var(--border)";
      el.style.color = "var(--text)";
      el.style.fontSize = "12px";
      el.style.borderRadius = "8px";
      el.style.whiteSpace = "pre";
      el.classList.add("debug-ui");
      if (!isDebugUI()) el.classList.add("debug-ui-hidden");
      document.body.appendChild(el);
    }
    return el;
  }

  function applyDebugVisibility() {
    const debugEls = document.querySelectorAll(".debug-ui");
    debugEls.forEach((el) => {
      if (isDebugUI()) el.classList.remove("debug-ui-hidden");
      else el.classList.add("debug-ui-hidden");
    });
  }

  function assignTrackOrderByGeometry() {
    const boardRoot = $("soureBoard");
    if (!boardRoot) return false;
    const fields = Array.from(boardRoot.querySelectorAll(".track-field"));
    if (fields.length !== 26) {
      console.error("[TRACK_GEOM_INVALID]", "field_count", fields.length);
      return false;
    }

    const centers = fields.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        el,
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2
      };
    });

    const minX = Math.min(...centers.map((c) => c.cx));
    const maxX = Math.max(...centers.map((c) => c.cx));
    const minY = Math.min(...centers.map((c) => c.cy));
    const maxY = Math.max(...centers.map((c) => c.cy));
    const tol = Math.max(10, Math.max(maxX - minX, maxY - minY) * 0.05);

    const top = [];
    const bottom = [];
    const left = [];
    const right = [];
    let TL = null;
    let TR = null;
    let BR = null;
    let BL = null;

    centers.forEach((c) => {
      const isTop = Math.abs(c.cy - minY) <= tol;
      const isBottom = Math.abs(c.cy - maxY) <= tol;
      const isLeft = Math.abs(c.cx - minX) <= tol;
      const isRight = Math.abs(c.cx - maxX) <= tol;

      if (isTop && isLeft) TL = c;
      else if (isTop && isRight) TR = c;
      else if (isBottom && isRight) BR = c;
      else if (isBottom && isLeft) BL = c;
      else if (isTop) top.push(c);
      else if (isRight) right.push(c);
      else if (isBottom) bottom.push(c);
      else if (isLeft) left.push(c);
    });

    if (!TL || !TR || !BR || !BL) {
      console.error("[TRACK_GEOM_INVALID]", { TL: !!TL, TR: !!TR, BR: !!BR, BL: !!BL });
      return false;
    }

    top.sort((a, b) => a.cx - b.cx);
    right.sort((a, b) => a.cy - b.cy);
    bottom.sort((a, b) => b.cx - a.cx);
    left.sort((a, b) => b.cy - a.cy);

    const order = [
      TL,
      ...top,
      TR,
      ...right,
      BR,
      ...bottom,
      BL,
      ...left
    ].map((c) => c.el);

    if (order.length !== 26) {
      console.error("[TRACK_GEOM_INVALID]", "order_len", order.length);
      return false;
    }

    order.forEach((el, index) => {
      el.setAttribute("data-track-index", String(index));
    });

    return true;
  }

  function diceImgSrc(v) {
    return `/assets/dice/dice-${v}.png`;
  }

  function resourceIconSrc(type) {
    return `/assets/resources/${type}.png`;
  }

  function updateDiceDisplay(d1, d2) {
    const slots = [
      { img: $("dice1Img"), text: $("dice1Text") },
      { img: $("dice2Img"), text: $("dice2Text") }
    ];
    const vals = [d1, d2];
    slots.forEach((s, i) => {
      const v = vals[i];
      if (!s.img || !s.text) return;
      s.text.textContent = v != null ? String(v) : "?";
      if (v != null && v >= 1 && v <= 6) {
        s.img.src = diceImgSrc(v);
        s.img.style.display = "";
        s.text.style.display = "none";
        s.img.onerror = () => {
          s.img.style.display = "none";
          s.text.style.display = "";
        };
      } else {
        s.img.style.display = "none";
        s.text.style.display = "";
      }
    });
  }

  function showError(msg) {
    const el = $("errorEl");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 5000);
  }

  function hideError() {
    const el = $("errorEl");
    if (el) el.classList.add("hidden");
  }

  function toggleHidden(id, hide) {
    const el = $(id);
    if (hide) el.classList.add("hidden");
    else el.classList.remove("hidden");
  }

  function renderLoginStatus() {
    const status = $("loginStatus");
    const loginLink = $("loginLink");
    const logoutBtn = $("logoutBtn");
    if (!status && !loginLink && !logoutBtn) return;
    if (user) {
      if (status) status.textContent = "Logged in as " + user.username;
      if (loginLink) loginLink.classList.add("hidden");
      if (logoutBtn) logoutBtn.classList.remove("hidden");
    } else {
      if (status) status.textContent = "Not logged in";
      if (loginLink) loginLink.classList.remove("hidden");
      if (logoutBtn) logoutBtn.classList.add("hidden");
    }
  }

  function fetchMe() {
    return fetch("/api/me", { credentials: "same-origin" }).then((r) => r.json());
  }

  function initAuth() {
    return fetchMe().then((data) => {
      console.log("[game] /api/me response:", data);
      if (!data.ok) {
        console.error("[game] /api/me failed: not ok");
        setTimeout(() => { window.location.href = "/login"; }, 100);
        return Promise.reject(new Error("Failed to fetch /api/me"));
      }
      user = data.user;
      if (!user) {
        console.log("[game] No user session, redirecting to login");
        setTimeout(() => { window.location.href = "/login"; }, 100);
        return Promise.reject(new Error("redirect"));
      }
      console.log("[game] User authenticated:", user.username, "userId:", user.id);
      renderLoginStatus();
      checkActiveGame();
    }).catch((err) => {
      console.error("[game] Auth initialization error:", err);
      if (err.message !== "redirect" && err.message !== "Failed to fetch /api/me") {
        showError("Failed to authenticate. Please refresh the page or log in again.");
      }
    });
  }

  function checkActiveGame() {
    if (!user) return;
    // Only check for active game if we're NOT already in a game
    if (inGame() && state && state.phase !== "lobby") {
      hideRejoinBanner();
      return;
    }
    fetch("/api/active-game", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => {
        console.log("[game] /api/active-game response:", data);
        const storedRejoinId = getRejoinGameId();
        const shouldShowRejoin = storedRejoinId && data.gameId && storedRejoinId === data.gameId;
        // Only show rejoin if we're NOT in an active game and a rejoin is pending
        if (data.ok && shouldShowRejoin && (!inGame() || state?.phase === "lobby")) {
          console.log("[game] Active game found:", data.gameId);
          showRejoinBanner(data.gameId);
        } else {
          hideRejoinBanner();
          if (data.ok && !data.gameId) {
            clearRejoinGameId();
          }
        }
      })
      .catch((err) => {
        console.error("[game] Failed to check active game:", err);
      });
  }

  function showRejoinBanner(gameId) {
    const banner = $("rejoinBanner");
    if (banner) {
      banner.classList.remove("hidden");
      const rejoinBtn = $("rejoinBtn");
      if (rejoinBtn) {
        rejoinBtn.onclick = () => {
          console.log("[game] Rejoin button clicked, navigating to:", `/play/${gameId}`);
          window.location.href = `/play/${gameId}`;
        };
      }
    }
  }

  function hideRejoinBanner() {
    const banner = $("rejoinBanner");
    if (banner) {
      banner.classList.add("hidden");
    }
  }

  function showGameEndedInactive() {
    const endedEl = $("gameEndedInactive");
    const createJoin = $("lobbyCreateJoin");
    const room = $("lobbyRoom");
    if (endedEl) endedEl.classList.remove("hidden");
    if (createJoin) createJoin.classList.add("hidden");
    if (room) room.classList.add("hidden");
  }

  function hideGameEndedInactive() {
    const endedEl = $("gameEndedInactive");
    if (endedEl) endedEl.classList.add("hidden");
  }

  function getRejoinGameId() {
    return sessionStorage.getItem(REJOIN_STORAGE_KEY);
  }

  function clearRejoinGameId() {
    sessionStorage.removeItem(REJOIN_STORAGE_KEY);
    try { localStorage.removeItem(LAST_GAME_ID_KEY); } catch (_) {}
  }

  function setLastGameId(gameId) {
    try { if (gameId) localStorage.setItem(LAST_GAME_ID_KEY, gameId); } catch (_) {}
  }

  const logoutBtn = $("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      fetch("/api/logout", { method: "POST", credentials: "same-origin" })
        .then(() => {
          user = null;
          window.location.href = "/";
        });
    });
  }

  let rollPending = false;

  function setRollPending(isPending) {
    rollPending = isPending;
    const rollBtn = $("rollBtn");
    if (rollBtn) rollBtn.disabled = isPending;
  }

  function connectSocket() {
    if (socket) return;
    socket = io({ withCredentials: true });
    socket.off("connect");
    socket.off("connect_error");
    socket.off("error");
    socket.off("gameState");
    socket.off("createGameResult");
    socket.off("joinGameResult");
    socket.off("rollResult");

    socket.on("connect", () => {
      console.log("[game] Socket connected, id:", socket.id);
      hideError();
    });

    socket.on("connect_error", (error) => {
      console.error("[game] Socket connect_error:", error);
      const errorMsg = "Connection failed. " + (error.message || "Ensure you are logged in and try refreshing the page.");
      showError(errorMsg);
      setRollPending(false);
      // On mobile, this might be a session issue - show more helpful message
      if (navigator.userAgent.match(/Mobile|Android|iPhone|iPad/)) {
        console.error("[game] Mobile connection error - possible session/cookie issue");
        showError("Mobile connection failed. Please ensure cookies are enabled and try logging in again.");
      }
    });

    socket.on("error", (payload) => {
      showError(payload.message || "Error");
      setRollPending(false);
    });

    socket.on("gameState", (s) => {
      console.log("[game] gameState received:", s ? { gameId: s.gameId, phase: s.phase, playersCount: s.players?.length, creatorId: s.creatorId, currentTurnPlayerId: s.currentTurnPlayerId } : "null");
      if (!s) {
        console.warn("[game] Received null gameState");
        state = null;
        renderState();
        return;
      }
      state = s;
      setRollPending(false);
      const me = s.players?.find((p) => p.id === user?.id);
      if (me) {
        console.log("[CLIENT_RENDER_POS]", me.id, "rendering positionIndex =", me.positionIndex);
      }
      console.log("[STATE_POS]", s.currentTurnPlayerId, "positionIndex", s.positionIndexByPlayerId?.[s.currentTurnPlayerId]);
      if (s.gameId && s.phase !== "lobby") setLastGameId(s.gameId);
      console.log("[game] Updating state, calling renderState");
      console.log("[game] Current player resources:", s.resources && user ? s.resources[user.id] : "N/A");
      renderState();
      renderInventory();
      schedulePlacement();
    });

    socket.on("createGameResult", (r) => {
      console.log("[game] createGameResult received:", r);
      if (!r.ok) {
        showError(r.error || "Create game failed");
      } else {
        console.log("[game] Game created successfully, gameId:", r.gameId);
        setLastGameId(r.gameId);
        clearRejoinGameId();
        hideRejoinBanner();
        showError(""); // Clear any errors
      }
    });

    socket.on("joinGameResult", (r) => {
      if (!r.ok) showError(r.error || "Join game failed");
      else if (r.ok && r.gameId) setLastGameId(r.gameId);
    });

    socket.on("rollResult", (result) => {
      console.log("[game] rollResult received:", result);
      setRollPending(false);
      const dice1 = $("dice1");
      const dice2 = $("dice2");
      if (dice1 && dice2) {
        dice1.classList.add("rolling");
        dice2.classList.add("rolling");
        setTimeout(() => {
          if (result && result.roll) {
            updateDiceDisplay(result.roll.d1, result.roll.d2);
          }
          setTimeout(() => {
            dice1.classList.remove("rolling");
            dice2.classList.remove("rolling");
          }, 100);
        }, 500);
      }
    });
  }

  function inGame() {
    return state && state.gameId;
  }

  function isCurrentPlayer() {
    return inGame() && user && state.currentTurnPlayerId === user.id;
  }

  function isCreator() {
    return inGame() && user && state.creatorId === user.id;
  }

  function isBreach() {
    return state && state.phase === "breach";
  }

  function getInitials(username) {
    if (!username) return "?";
    const parts = username.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
    }
    return username.slice(0, 2).toUpperCase();
  }

  function renderLobby() {
    const lobbySection = $("lobbySection");
    const lobbyCreateJoin = $("lobbyCreateJoin");
    const lobbyRoom = $("lobbyRoom");
    const lobbyPlayers = $("lobbyPlayers");
    const lobbyStartBtn = $("lobbyStartBtn");
    const startBtnLobby = $("startBtnLobby");
    const gameTopbarGameId = $("gameTopbarGameId");
    const gameTimer = $("gameTimer");

    if (!lobbySection) return;
    if (state?.phase === "ended") return;

    if (!inGame() || state?.phase !== "lobby") {
      if (lobbyCreateJoin) lobbyCreateJoin.classList.remove("hidden");
      if (lobbyRoom) lobbyRoom.classList.add("hidden");
      if (gameTopbarGameId) {
        gameTopbarGameId.classList.remove("hidden");
        gameTopbarGameId.textContent = "Game ID: —";
      }
      if (gameTimer) gameTimer.classList.add("hidden");
      return;
    }

    if (lobbyCreateJoin) lobbyCreateJoin.classList.add("hidden");
    if (lobbyRoom) lobbyRoom.classList.remove("hidden");

    if (gameTopbarGameId) {
      gameTopbarGameId.classList.remove("hidden");
      gameTopbarGameId.textContent = "Game ID: " + (state.gameId || "—");
    }
    if (gameTimer) gameTimer.classList.add("hidden");

    if (lobbyPlayers) {
      lobbyPlayers.innerHTML = "";
      const players = state.players || [];
      const maxSlots = 4;
      for (let i = 0; i < maxSlots; i++) {
        const p = players[i];
        const slot = document.createElement("div");
        slot.className = "game-lobby-slot";
        slot.setAttribute("role", "listitem");
        if (p) {
          const isCreator = p.id === state.creatorId;
          slot.classList.add("filled");
          slot.innerHTML = `
            <div class="player-circle ${isCreator ? "creator" : ""}" title="${escapeHtml(p.name)}">${getInitials(p.name)}</div>
            <div class="player-name">${escapeHtml(p.name)}</div>
          `;
        } else {
          slot.classList.add("empty");
          slot.innerHTML = '<div class="player-circle player-circle-empty" aria-hidden="true"></div><div class="player-name" aria-hidden="true">—</div>';
        }
        lobbyPlayers.appendChild(slot);
      }
    }

    const creatorCheck = isCreator();
    if (lobbyStartBtn) {
      if (creatorCheck) {
        lobbyStartBtn.classList.remove("hidden");
        if (startBtnLobby) startBtnLobby.disabled = false;
      } else {
        lobbyStartBtn.classList.add("hidden");
        if (startBtnLobby) startBtnLobby.disabled = true;
      }
    }
  }

  function renderInventory() {
    const resourceBar = $("resourceBar");

    if (!inGame() || !user) {
      if (resourceBar) resourceBar.classList.add("hidden");
      return;
    }

    if (resourceBar) resourceBar.classList.remove("hidden");
    const myRes = (state.resources && state.resources[user.id]) || {};
    resourceBar.innerHTML = "";
    RESOURCES.forEach((k) => {
      const count = myRes[k] || 0;
      const name = k[0].toUpperCase() + k.slice(1);
      const chip = document.createElement("div");
      chip.className = "inventory-chip" + (count > 0 ? " has-resource" : "");
      chip.innerHTML = `
        <img class="resource-icon" src="${resourceIconSrc(k)}" alt="" onerror="this.style.display='none'"/>
        <span style="text-transform: capitalize;">${name}</span>
        <strong style="color: ${count > 0 ? 'var(--success)' : 'var(--muted)'};">${count}</strong>
      `;
      resourceBar.appendChild(chip);
    });
  }

  function renderBoard() {
    const trackTop = $("trackTop");
    const trackRight = $("trackRight");
    const trackBottom = $("trackBottom");
    const trackLeft = $("trackLeft");
    const boardCenter = $("boardCenter");
    if (!trackTop || !trackRight || !trackBottom || !trackLeft) return;

    const track = (state && state.track && state.track.length) ? state.track : null;
    if (!track) return;
    const trackByDomId = {};
    const trackIndexByDomId = {};
    if (track && track.length) {
      track.forEach((cell, i) => {
        trackByDomId[cell.domId] = cell;
        trackIndexByDomId[cell.domId] = cell.index != null ? cell.index : i;
      });
    }

    function formatResourceLabel(resourceType) {
      if (!resourceType) return "";
      return resourceType[0].toUpperCase() + resourceType.slice(1);
    }

    function createSlot(index, label, meta, domId, extraClasses) {
      const slot = document.createElement("div");
      slot.className = "track-slot track-field track-resource" + (extraClasses ? " " + extraClasses : "");
      slot.id = domId;
      slot.dataset.index = String(index);
      slot.setAttribute("data-track-index", String(index));
      slot.setAttribute("data-kind", "resource");
      slot.style.position = "relative";
      const labelEl = document.createElement("div");
      labelEl.className = "slot-label";
      labelEl.textContent = label;
      const metaEl = document.createElement("div");
      metaEl.className = "slot-meta";
      metaEl.textContent = meta || "";
      slot.appendChild(labelEl);
      slot.appendChild(metaEl);
      return slot;
    }

    function fillTrack(container, domIds) {
      container.innerHTML = "";
      domIds.forEach((domId) => {
        const cell = trackByDomId[domId];
        const idx = trackIndexByDomId[domId] != null ? trackIndexByDomId[domId] : 0;
        const label = formatResourceLabel(cell && cell.resourceType);
        const meta = "";
        container.appendChild(createSlot(idx, label, meta, domId));
      });
    }

    fillTrack(trackTop, ["cell-top-0", "cell-top-1", "cell-top-2", "cell-top-3", "cell-top-4", "cell-top-5", "cell-top-6"]);
    fillTrack(trackRight, ["cell-right-0", "cell-right-1", "cell-right-2", "cell-right-3"]);
    fillTrack(trackBottom, ["cell-bottom-6", "cell-bottom-5", "cell-bottom-4", "cell-bottom-3", "cell-bottom-2", "cell-bottom-1", "cell-bottom-0"]);
    fillTrack(trackLeft, ["cell-left-0", "cell-left-1", "cell-left-2", "cell-left-3"]);

    track.forEach((field) => {
      const el = document.getElementById(field.domId);
      if (!el) return;
      el.classList.add("track-field");
      if (field.kind === "corner") {
        el.classList.add("track-corner");
        el.setAttribute("data-kind", "corner");
        if (field.cornerId) el.setAttribute("data-corner-id", field.cornerId);
      }
    });

    assignTrackOrderByGeometry();

    ensureDebugStyles();
    runTrackAudit("renderBoard");

    if (boardCenter) {
      boardCenter.textContent = "";
      if (!state.board) {
        const p = document.createElement("p");
        p.className = "board-center-placeholder";
        p.textContent = "Grand Bazaar";
        boardCenter.appendChild(p);
      }
    }
  }

  /**
   * Render player tokens on the board overlay. Positions come from state (server-authoritative).
   * TRACK order comes from server/track.js. Tokens at same cell get a 2x2 grid offset.
   */
  function getTileElByIndex(i) {
    return document.querySelector(`.track-field[data-track-index="${i}"]`);
  }

  function runTrackAudit(source) {
    const boardRoot = $("soureBoard");
    const fields = Array.from(boardRoot ? boardRoot.querySelectorAll(".track-field[data-track-index]") : []);
    const indices = fields
      .map((el) => Number(el.getAttribute("data-track-index")))
      .filter((n) => Number.isInteger(n))
      .sort((a, b) => a - b);
    const seen = new Map();
    indices.forEach((idx) => {
      seen.set(idx, (seen.get(idx) || 0) + 1);
    });
    const duplicates = [];
    const missing = [];
    for (let i = 0; i < 26; i += 1) {
      if (!seen.has(i)) missing.push(i);
      if (seen.get(i) > 1) duplicates.push(i);
    }
    const min = indices.length ? indices[0] : null;
    const max = indices.length ? indices[indices.length - 1] : null;
    const uniqueCount = seen.size;
    const invalid = fields.length !== 26 || uniqueCount !== 26 || min !== 0 || max !== 25 || duplicates.length > 0 || missing.length > 0;
    if (invalid) {
      console.error("[TRACK_INVALID]", {
        count: fields.length,
        unique: uniqueCount,
        min,
        max,
        indices,
        duplicates,
        missing
      });
    }
    setDebugWarningVisible(invalid);
    const cornerEls = Array.from(boardRoot ? boardRoot.querySelectorAll(".track-field.track-corner[data-track-index]") : []);
    const cornerIdxs = cornerEls.map((el) => Number(el.dataset.trackIndex)).filter((n) => Number.isInteger(n));
    const cornerSeen = new Map();
    cornerIdxs.forEach((idx) => {
      cornerSeen.set(idx, (cornerSeen.get(idx) || 0) + 1);
    });
    const cornerDuplicates = [];
    cornerSeen.forEach((count, idx) => {
      if (count > 1) cornerDuplicates.push(idx);
    });
    const cornerInvalid = cornerEls.length !== 4 || cornerSeen.size !== 4 || cornerDuplicates.length > 0;
    if (cornerInvalid) {
      console.error("[CORNER_INVALID]", {
        count: cornerEls.length,
        indices: cornerIdxs,
        duplicates: cornerDuplicates
      });
    }
    setCornerDebugWarningVisible(cornerInvalid);
    console.log("[TRACK_AUDIT]", source, {
      count: fields.length,
      indices,
      duplicates,
      missing
    });
    return !invalid && !cornerInvalid;
  }

  function getFieldEl(idx) {
    const boardRoot = $("soureBoard");
    const matches = boardRoot
      ? boardRoot.querySelectorAll(`.track-field[data-track-index="${idx}"]`)
      : [];
    if (matches.length !== 1) {
      console.error("[FIELD_MATCH_BAD]", idx, matches.length, matches);
      return null;
    }
    return matches[0];
  }

  function getCenterWithinBoard(boardEl, fieldEl) {
    if (!boardEl || !fieldEl) return null;
    if (!boardEl.contains(fieldEl) || fieldEl.offsetParent !== boardEl) {
      console.error("[FIELD_PARENT_BAD]", fieldEl, "offsetParent", fieldEl.offsetParent);
      return null;
    }
    const x = fieldEl.offsetLeft + fieldEl.offsetWidth / 2;
    const y = fieldEl.offsetTop + fieldEl.offsetHeight / 2;
    return { x, y };
  }

  function placeAllTokens() {
    const tokenLayer = $("tokenLayer");
    const TRACK = (state && state.track && state.track.length) ? state.track : null;
    const TRACK_LEN = TRACK ? TRACK.length : 0;
    const board = $("soureBoard");
    if (!tokenLayer || !TRACK || !TRACK_LEN || !state || !state.players || state.players.length === 0) {
      if (tokenLayer) tokenLayer.innerHTML = "";
      if (board) {
        const existing = board.querySelectorAll(".token");
        existing.forEach((el) => el.remove());
      }
      return;
    }
    tokenLayer.innerHTML = "";
    const existingTokens = board.querySelectorAll(".token");
    existingTokens.forEach((el) => el.remove());
    const players = state.players;
    const positionIndexByPlayerId = state.positionIndexByPlayerId || {};
    const tokenStyleByPlayerId = state.tokenStyleByPlayerId || {};
    const TOKEN_SIZE = 18;
    const OFFSET_STEP = 10;

    const items = players.map((p) => {
      const pos = Math.max(0, Math.min(TRACK_LEN - 1, positionIndexByPlayerId[p.id] ?? 0));
      const style = tokenStyleByPlayerId[p.id] || { shape: "circle", color: "#8b5cf6" };
      return { player: p, pos, style };
    });
    const byPos = {};
    items.forEach((item, i) => {
      if (!byPos[item.pos]) byPos[item.pos] = [];
      byPos[item.pos].push({ ...item, orderIndex: byPos[item.pos].length });
    });

    items.forEach((item) => {
      const anchor = getFieldEl(item.pos);
      if (!anchor) {
        console.error("[TOKEN_PLACE]", "missing track field for index", item.pos);
        return;
      }
      const posCount = byPos[item.pos].length;
      const offsetIndex = byPos[item.pos].findIndex((x) => x.player.id === item.player.id);
      const offsetX = (offsetIndex % 2) * OFFSET_STEP;
      const offsetY = Math.floor(offsetIndex / 2) * OFFSET_STEP;

      const token = document.createElement("div");
      token.className = "token " + (item.style.shape === "square" ? "token-square" : "token-circle");
      token.setAttribute("data-player-id", item.player.id);
      token.setAttribute("aria-hidden", "true");
      token.style.background = item.style.color;
      token.style.width = TOKEN_SIZE + "px";
      token.style.height = TOKEN_SIZE + "px";
      token.style.left = "50%";
      token.style.top = "50%";
      token.style.transform = `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px)`;
      if (isDebugUI()) {
        const badge = document.createElement("div");
        badge.textContent = `idx:${item.pos}`;
        badge.style.position = "absolute";
        badge.style.top = "-12px";
        badge.style.left = "50%";
        badge.style.transform = "translateX(-50%)";
        badge.style.fontSize = "10px";
        badge.style.color = "var(--text)";
        badge.style.background = "rgba(0,0,0,0.6)";
        badge.style.borderRadius = "6px";
        badge.style.padding = "0 4px";
        badge.style.pointerEvents = "none";
        token.appendChild(badge);
      }
      if (anchor.dataset.kind === "corner") {
        console.log(
          "[TOKEN_CORNER_PLACE]",
          item.pos,
          anchor.dataset.cornerId,
          { offsetLeft: anchor.offsetLeft, offsetTop: anchor.offsetTop, w: anchor.offsetWidth, h: anchor.offsetHeight }
        );
      }
      anchor.appendChild(token);
    });
  }

  function schedulePlacement() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        placeAllTokens();
      });
    });
  }

  /** Corner circles: color-code by assigned player (border + glow match token color). Unassigned = neutral. */
  function applyCornerColors() {
    if (!state || !state.players) return;
    const cornerIdToColor = {};
    state.players.forEach((p) => {
      if (p.cornerId && p.color) {
        cornerIdToColor[p.cornerId] = p.color;
      }
    });
    const cornerEls = document.querySelectorAll(".track-corner[data-corner-id]");
    cornerEls.forEach((el) => {
      const cornerId = el.getAttribute("data-corner-id");
      const color = cornerIdToColor[cornerId];
      if (color) {
        el.style.borderColor = color;
        el.style.boxShadow = `0 0 12px ${color}, inset 0 0 10px rgba(0,0,0,0.25)`;
      } else {
        el.style.borderColor = "";
        el.style.boxShadow = "";
      }
    });
  }

  let selectedBuildingType = null;
  let lastLandingLogKey = null;

  function highlightLandedField() {
    if (!state || !state.currentTurnPlayerId) return;
    const pos = state.positionIndexByPlayerId && state.positionIndexByPlayerId[state.currentTurnPlayerId];
    if (pos == null) return;
    const el = getFieldEl(pos);
    if (!el) return;
    el.classList.add(LANDED_HIGHLIGHT_CLASS);
    setTimeout(() => {
      el.classList.remove(LANDED_HIGHLIGHT_CLASS);
    }, 500);
  }

  function logLandingLabel() {
    if (!state || !state.lastRoll || !state.track || !state.currentTurnPlayerId) return;
    const playerId = state.currentTurnPlayerId;
    const pos = state.positionIndexByPlayerId && state.positionIndexByPlayerId[playerId];
    if (pos == null) return;
    const cell = state.track.find((c) => c.index === pos) || state.track[pos];
    const resourceType = cell && cell.resourceType ? cell.resourceType : "none";
    const key = `${playerId}:${pos}:${state.lastRoll.d1}:${state.lastRoll.d2}`;
    if (key === lastLandingLogKey) return;
    lastLandingLogKey = key;
    let labelFromDom = null;
    const tileEl = getTileElByIndex(pos);
    if (tileEl) {
      const labelEl = tileEl.querySelector(".slot-label");
      if (labelEl) labelFromDom = labelEl.textContent;
    }
    console.log(
      "[game] landing label for index",
      pos,
      "track resource=",
      resourceType,
      "dom label=",
      labelFromDom,
      "track length=",
      state.track.length
    );
  }

  function renderPlayers() {
    const playersList = $("playersList");
    if (!playersList) return;

    playersList.innerHTML = "";

    (state.players || []).forEach((p) => {
      const playerEl = document.createElement("div");
      playerEl.className = "player-card";
      if (p.id === state.currentTurnPlayerId) {
        playerEl.classList.add("current");
      }

      const color = p.color || "var(--muted)";

      playerEl.innerHTML = `
        <div class="player-card-header">
          <div class="player-name">
            <span class="player-color-dot" style="background:${color}"></span>
            <strong>${escapeHtml(p.name)}</strong>
          </div>
          ${p.id === state.currentTurnPlayerId ? '<span class="current-badge">Current</span>' : ""}
        </div>
      `;

      playersList.appendChild(playerEl);
    });
  }

  let timerInterval = null;

  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    if (!state.matchStartTime) return;
    
    timerInterval = setInterval(() => {
      updateTimer();
    }, 1000);
    updateTimer();
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function updateTimer() {
    const timerEl = $("gameTimer");
    if (!timerEl || !state.matchStartTime) return;
    
    const elapsed = Math.floor((Date.now() - state.matchStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    timerEl.textContent = `Time: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function renderDice() {
    const diceContainer = $("diceContainer");
    const dice1 = $("dice1");
    const dice2 = $("dice2");
    const diceResult = $("diceResult");

    if (!inGame() || state.phase === "lobby") {
      if (diceContainer) diceContainer.classList.add("hidden");
      if (diceResult) diceResult.classList.add("hidden");
      stopTimer();
      return;
    }

    // Start timer when match starts
    if (state.matchStartTime) {
      if (!timerInterval) {
        startTimer();
      }
    }

    if (diceContainer) diceContainer.classList.remove("hidden");

    const lr = state.lastRoll;
    if (lr && lr.d1 != null) {
      updateDiceDisplay(lr.d1, lr.d2);
      if (diceResult) {
        diceResult.classList.remove("hidden");
        diceResult.textContent = `Roll: ${lr.d1} + ${lr.d2} = ${lr.total}${lr.isDouble ? " (Doubles!)" : ""}`;
      }
    } else {
      updateDiceDisplay(null, null);
      if (diceResult) diceResult.classList.add("hidden");
    }
  }

  function updateDebugOverlay() {
    if (!isDebugUI()) return;
    const badge = ensureDebugBadge();
    if (!state || !state.currentTurnPlayerId) {
      badge.textContent = "No state";
      return;
    }
    const currentId = state.currentTurnPlayerId;
    const currentPos = state.positionIndexByPlayerId
      ? state.positionIndexByPlayerId[currentId]
      : null;
    const lastRoll = state.lastRoll;
    const steps = lastRoll ? lastRoll.total : null;
    const oldPos = lastRoll && currentPos != null ? ((currentPos - steps + 26) % 26) : null;
    badge.textContent =
      `player: ${currentId}\n` +
      `oldIndex: ${oldPos}\n` +
      `steps: ${steps}\n` +
      `newIndex: ${currentPos}`;
  }

  function renderBreachPanel() {
    const breachPanel = $("breachPanel");
    const tileSelection = $("tileSelection");
    if (breachPanel) breachPanel.classList.add("hidden");
    if (!tileSelection) return;
    tileSelection.innerHTML = "";
    if (!state.board || !state.board.tiles) return;

    state.board.tiles.forEach((tile) => {
      if (tile.type === "grandBazaar" || tile.type === "market") return;

      const btn = document.createElement("button");
      btn.className = "btn tile-select-btn";
      btn.textContent = `Tile ${tile.id} (${tile.type}${tile.number ? `, ${tile.number}` : ''})`;
      if (tile.id === state.board.blockedTileId) {
        btn.disabled = true;
        btn.textContent += " (Already blocked)";
      }
      btn.addEventListener("click", () => {
        socket.emit("blockTile", tile.id);
      });
      tileSelection.appendChild(btn);
    });
  }

  function renderBuildingPanel() {
    const buildingPanel = $("buildingPanel");
    const tileSelection = $("buildingTileSelection");
    if (!buildingPanel) return;

    if (state.phase !== "main" || !isCurrentPlayer()) {
      buildingPanel.classList.add("hidden");
      return;
    }

    buildingPanel.classList.remove("hidden");

    const buttons = buildingPanel.querySelectorAll("[data-building]");
    buttons.forEach(btn => {
      btn.classList.remove("selected");
      if (btn.dataset.building === selectedBuildingType) {
        btn.classList.add("selected");
      }
      btn.onclick = () => {
        if (selectedBuildingType === btn.dataset.building) {
          selectedBuildingType = null;
        } else {
          selectedBuildingType = btn.dataset.building;
        }
        renderBuildingPanel();
      };
    });

    if (tileSelection) {
      tileSelection.innerHTML = "";
      if (selectedBuildingType && state.board && state.board.tiles) {
        const resourceTiles = state.board.tiles.filter(t =>
          t.type !== "grandBazaar" && t.type !== "market" && RESOURCES.indexOf(t.type) >= 0
        );
        resourceTiles.forEach((tile) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "btn tile-select-btn";
          btn.textContent = `Tile ${tile.id} (${tile.type}${tile.number != null ? ", " + tile.number : ""})`;
          btn.addEventListener("click", () => {
            socket.emit("placeBuilding", { tileId: tile.id, buildingType: selectedBuildingType });
            selectedBuildingType = null;
            renderBuildingPanel();
          });
          tileSelection.appendChild(btn);
        });
        tileSelection.classList.remove("hidden");
      } else {
        tileSelection.classList.add("hidden");
      }
    }
  }

  function renderState() {
    const info = $("gameInfoSection");
    const lobbySection = $("lobbySection");
    if (!state) {
      hideGameEndedInactive();
      if (lobbySection) lobbySection.classList.remove("hidden");
      if (info) info.classList.add("hidden");
      renderLobby();
      return;
    }

    const log = $("logSection");
    const breachPanel = $("breachPanel");
    const buildingPanel = $("buildingPanel");

    // Hide rejoin banner when in-game (not in lobby)
    if (inGame() && state.phase !== "lobby") {
      hideRejoinBanner();
    }

    if (!inGame()) {
      hideGameEndedInactive();
      console.log("[game] Not in game, showing create/join section");
      if (lobbySection) lobbySection.classList.remove("hidden");
      if (info) info.classList.add("hidden");
      if (log) log.classList.add("hidden");
      if (breachPanel) breachPanel.classList.add("hidden");
      if (buildingPanel) buildingPanel.classList.add("hidden");
      renderLobby();
      renderInventory();
      stopTimer();
      // Check for active game when not in game
      checkActiveGame();
      return;
    }

    // Render lobby if in lobby phase
    if (state.phase === "lobby") {
      hideGameEndedInactive();
      console.log("[game] Rendering lobby phase");
      if (lobbySection) lobbySection.classList.remove("hidden");
      if (info) info.classList.add("hidden");
      if (log) log.classList.add("hidden");
      if (breachPanel) breachPanel.classList.add("hidden");
      if (buildingPanel) buildingPanel.classList.add("hidden");
      renderLobby();
      renderInventory();
      stopTimer();
      checkActiveGame();
      return;
    }

    // Game ended (e.g. inactivity auto-stop)
    if (state.phase === "ended") {
      clearRejoinGameId();
      if (lobbySection) lobbySection.classList.remove("hidden");
      if (info) info.classList.add("hidden");
      showGameEndedInactive();
      renderLobby();
      renderInventory();
      stopTimer();
      return;
    }

    // Game phase - show game UI
    hideGameEndedInactive();
    lobbySection.classList.add("hidden");
    info.classList.remove("hidden");
    log.classList.remove("hidden");
    const gameTopbarGameId = $("gameTopbarGameId");
    const gameTimer = $("gameTimer");
    if (gameTopbarGameId) gameTopbarGameId.classList.add("hidden");
    if (gameTimer) gameTimer.classList.remove("hidden");
    
    renderBoard();
    applyDebugVisibility();
    const valid = runTrackAudit("renderState");
    if (valid) {
      schedulePlacement();
    }
    applyCornerColors();
    renderPlayers();
    renderDice();
    renderInventory();
    renderBreachPanel();
    renderBuildingPanel();
    logLandingLabel();
    updateDebugOverlay();
    highlightLandedField();

    // Game info removed - now in sidebar

    const roll = state.phase === "roll";
    const main = state.phase === "main";
    const breach = state.phase === "breach";

    const rollBtn = $("rollBtn");
    const endTurnBtn = $("endTurnBtn");
    const blockTileBtn = $("blockTileBtn");
    
    // Always show Roll Dice button when it's roll phase and current player's turn
    console.log("[game] renderState - phase:", state.phase, "isCurrentPlayer:", isCurrentPlayer(), "roll:", roll);
    if (roll && isCurrentPlayer()) {
      console.log("[game] Showing Roll Dice button");
      if (rollBtn) {
        rollBtn.classList.remove("hidden");
        rollBtn.style.display = ""; // Ensure it's visible
        rollBtn.disabled = rollPending;
      }
    } else {
      if (rollBtn) {
        rollBtn.classList.add("hidden");
        rollBtn.disabled = false;
      }
    }
    
    if (main && isCurrentPlayer()) {
      if (endTurnBtn) endTurnBtn.classList.remove("hidden");
    } else {
      if (endTurnBtn) endTurnBtn.classList.add("hidden");
    }
    
    // MVP: Blocking is automatic, always hide the button
    if (blockTileBtn) blockTileBtn.classList.add("hidden");

    // Resources grid is now in sidebar

    const logEl = $("eventLog");
    logEl.innerHTML = "";
    (state.eventLog || []).forEach((e) => {
      const d = document.createElement("div");
      d.textContent = e.msg || "";
      logEl.appendChild(d);
    });
    logEl.scrollTop = logEl.scrollHeight;

    // Old barbarians/offer logic removed
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  $("createBtn").addEventListener("click", () => {
    console.log("[game] Create Game button clicked");
    console.log("[game] Socket:", socket ? { connected: socket.connected, id: socket.id } : "null");
    console.log("[game] User:", user ? { id: user.id, username: user.username } : "null");
    
    if (!socket) {
      console.error("[game] Socket not initialized");
      showError("Socket not connected. Please refresh the page.");
      return;
    }
    
    if (!user) {
      console.error("[game] User not authenticated");
      showError("Not logged in. Please log in first.");
      return;
    }
    
    if (!socket.connected) {
      console.error("[game] Socket not connected");
      showError("Connection lost. Please refresh the page.");
      return;
    }
    
    console.log("[game] Emitting createGame");
    socket.emit("createGame");
  });

  $("joinBtn").addEventListener("click", () => {
    const id = ($("joinInput").value || "").trim();
    if (!id) { showError("Enter a game ID"); return; }
    if (!socket || !user) return;
    socket.emit("joinGame", id);
  });

  $("startBtnLobby").addEventListener("click", () => {
    console.log("[game] Start Game button clicked");
    console.log("[game] User:", user ? { id: user.id, username: user.username } : "null");
    console.log("[game] State:", state ? { gameId: state.gameId, creatorId: state.creatorId, phase: state.phase, playersCount: state.players?.length } : "null");
    console.log("[game] Socket connected:", socket?.connected);
    console.log("[game] Socket id:", socket?.id);
    
    if (!socket || !user || !state) {
      console.error("[game] Cannot start: missing socket, user, or state");
      showError("Cannot start game: missing information");
      return;
    }
    
    if (!socket.connected) {
      console.error("[game] Cannot start: socket not connected");
      showError("Connection lost. Please refresh the page.");
      return;
    }
    
    const currentGameId = state.gameId;
    console.log("[game] Emitting startMatch for gameId:", currentGameId);
    socket.emit("startMatch");
    // Game stays on /game page - no redirect needed
  });

  function handleRollClick() {
    if (!socket || !user || rollPending) return;
    setRollPending(true);
    socket.emit("rollDice");
  }

  const rollBtnEl = $("rollBtn");
  if (rollBtnEl) {
    rollBtnEl.removeEventListener("click", handleRollClick);
    rollBtnEl.addEventListener("click", handleRollClick);
  }

  $("endTurnBtn").addEventListener("click", () => {
    if (!socket || !user) return;
    socket.emit("endTurn");
  });

  $("blockTileBtn")?.addEventListener("click", () => {
    // Block tile button triggers breach panel
    renderBreachPanel();
  });

  initAuth()
    .then(() => {
      renderLoginStatus();
      connectSocket();
    })
    .catch((e) => {
      if (e.message !== "redirect") showError(e.message || "Auth failed");
    });
})();
