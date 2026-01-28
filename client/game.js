(function () {
  "use strict";

  const RESOURCES = ["stone", "iron", "food", "water", "gold", "people"];

  // Catan-style 3-4-5-4-3 hex layout: [row, col] for tile index 0..18
  const HEX_GRID_LAYOUT = [
    [0, 0], [0, 1], [0, 2],                           // row 0: 3 tiles
    [1, 0], [1, 1], [1, 2], [1, 3],                    // row 1: 4
    [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],           // row 2: 5
    [3, 0], [3, 1], [3, 2], [3, 3],                    // row 3: 4
    [4, 0], [4, 1], [4, 2]                             // row 4: 3
  ];

  let user = null;
  let socket = null;
  let state = null;
  const REJOIN_STORAGE_KEY = "rejoinGameId";

  const $ = (id) => document.getElementById(id);

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

  function getRejoinGameId() {
    return sessionStorage.getItem(REJOIN_STORAGE_KEY);
  }

  function clearRejoinGameId() {
    sessionStorage.removeItem(REJOIN_STORAGE_KEY);
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

  function connectSocket() {
    socket = io({ withCredentials: true });

    socket.on("connect", () => {
      console.log("[game] Socket connected, id:", socket.id);
      hideError();
    });

    socket.on("connect_error", (error) => {
      console.error("[game] Socket connect_error:", error);
      const errorMsg = "Connection failed. " + (error.message || "Ensure you are logged in and try refreshing the page.");
      showError(errorMsg);
      // On mobile, this might be a session issue - show more helpful message
      if (navigator.userAgent.match(/Mobile|Android|iPhone|iPad/)) {
        console.error("[game] Mobile connection error - possible session/cookie issue");
        showError("Mobile connection failed. Please ensure cookies are enabled and try logging in again.");
      }
    });

    socket.on("error", (payload) => {
      showError(payload.message || "Error");
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
      console.log("[game] Updating state, calling renderState");
      console.log("[game] Current player resources:", s.resources && user ? s.resources[user.id] : "N/A");
      renderState();
      // Force re-render inventory to ensure resources are updated
      renderInventory();
    });

    socket.on("createGameResult", (r) => {
      console.log("[game] createGameResult received:", r);
      if (!r.ok) {
        showError(r.error || "Create game failed");
      } else {
        console.log("[game] Game created successfully, gameId:", r.gameId);
        // Hide rejoin banner when creating a new game
        clearRejoinGameId();
        hideRejoinBanner();
        // The gameState event will handle the UI update
        showError(""); // Clear any errors
      }
    });

    socket.on("joinGameResult", (r) => {
      if (!r.ok) showError(r.error || "Join game failed");
    });

    socket.on("rollResult", (result) => {
      console.log("[game] rollResult received:", result);
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
    const inventoryBar = $("inventoryBar");
    const inventoryChips = $("inventoryChips");

    if (!inGame() || !user) {
      if (inventoryBar) inventoryBar.classList.add("hidden");
      return;
    }

    if (inventoryBar) inventoryBar.classList.remove("hidden");
    const myRes = (state.resources && state.resources[user.id]) || {};
    console.log("[game] Rendering inventory for user:", user.id, "resources:", myRes);
    
    if (inventoryChips) {
      inventoryChips.innerHTML = "";
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
        inventoryChips.appendChild(chip);
      });
    }
  }

  function renderBoard() {
    const boardEl = $("hexBoard");
    if (!boardEl) {
      console.warn("[game] hexBoard element not found");
      return;
    }
    if (!state.board) {
      console.warn("[game] Board not generated yet");
      boardEl.innerHTML = "<p class=\"hex-board-placeholder\">Board will be generated when game starts…</p>";
      return;
    }

    const typeColors = {
      stone: "#8b8ba3",
      iron: "#6b7280",
      food: "#10b981",
      water: "#3b82f6",
      gold: "#f59e0b",
      people: "#ec4899",
      grandBazaar: "#a78bfa",
      market: "#a78bfa"
    };

    function typeLabel(type) {
      if (type === "grandBazaar" || type === "market") return "Grand Bazaar";
      return type[0].toUpperCase() + type.slice(1);
    }

    boardEl.innerHTML = "";
    const tilesById = state.board.tiles.reduce((acc, t) => { acc[t.id] = t; return acc; }, {});

    for (let id = 0; id < 19; id++) {
      const tile = tilesById[id];
      if (!tile) continue;
      const [row, col] = HEX_GRID_LAYOUT[id];

      const hex = document.createElement("div");
      hex.className = "hex-tile";
      hex.dataset.tileId = String(tile.id);
      hex.style.gridRow = String(row + 1);
      hex.style.gridColumn = String(col + 1);
      hex.style.backgroundColor = typeColors[tile.type] || "#1a1a1f";

      if (tile.id === state.board.blockedTileId) hex.classList.add("blocked");

      const typeLabelEl = document.createElement("div");
      typeLabelEl.className = "hex-type";
      typeLabelEl.textContent = typeLabel(tile.type);
      hex.appendChild(typeLabelEl);

      if (tile.number != null && tile.type !== "grandBazaar" && tile.type !== "market") {
        const numberEl = document.createElement("div");
        numberEl.className = "hex-number";
        numberEl.textContent = String(tile.number);
        hex.appendChild(numberEl);
      }

      const buildingsEl = document.createElement("div");
      buildingsEl.className = "hex-buildings";
      (tile.buildings || []).forEach((building) => {
        const buildingEl = document.createElement("div");
        buildingEl.className = "building building-" + building.type;
        buildingEl.title = building.type;
        const player = state.players.find(p => p.id === building.playerId);
        buildingEl.textContent = player ? getInitials(player.name) : "";
        buildingsEl.appendChild(buildingEl);
      });
      hex.appendChild(buildingsEl);

      if (state.phase === "main" && isCurrentPlayer() && selectedBuildingType) {
        hex.classList.add("clickable");
        hex.addEventListener("click", () => {
          socket.emit("placeBuilding", { tileId: tile.id, buildingType: selectedBuildingType });
          selectedBuildingType = null;
          renderBuildingPanel();
        });
      }

      boardEl.appendChild(hex);
    }
  }

  let selectedBuildingType = null;

  function renderPlayers() {
    const playerList = $("playerList");
    if (!playerList) return;
    
    playerList.innerHTML = "";
    
    (state.players || []).forEach((p) => {
      const playerEl = document.createElement("div");
      playerEl.className = "player-item-detailed";
      if (p.id === state.currentTurnPlayerId) {
        playerEl.classList.add("current");
      }
      
      const r = (state.resources && state.resources[p.id]) || {};
      const pop = p.population || { max: 3, used: 0 };
      const dp = p.dominionPoints || 0;
      const defense = p.defenseLevel || 0;
      
      playerEl.innerHTML = `
        <div class="player-header">
          <strong>${escapeHtml(p.name)}</strong>
          ${p.id === state.currentTurnPlayerId ? '<span class="current-badge">Current</span>' : ''}
        </div>
        <div class="player-stats">
          <div>DP: <strong>${dp}</strong></div>
          <div>Pop: <strong>${pop.used}/${pop.max}</strong></div>
          <div>Def: <strong>${defense}</strong></div>
        </div>
        <div class="player-resources-column" style="margin-top: 6px; font-size: 0.85rem; line-height: 1.2;">
          ${RESOURCES.map(k => {
            const count = r[k] || 0;
            const name = k[0].toUpperCase() + k.slice(1);
            const iconUrl = resourceIconSrc(k);
            return `<div class="resource-row ${count > 0 ? 'has' : ''}" style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
              <img class="resource-icon" src="${iconUrl}" alt="" onerror="this.style.display='none'"/>
              <span>${name}</span>
              <strong>${count}</strong>
            </div>`;
          }).join('')}
        </div>
      `;
      
      playerList.appendChild(playerEl);
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

  function renderBreachPanel() {
    const breachPanel = $("breachPanel");
    const tileSelection = $("tileSelection");
    
    // MVP: Blocking is automatic, always hide the panel
    if (breachPanel) breachPanel.classList.add("hidden");
    if (!tileSelection) return;
    
    tileSelection.innerHTML = "";
    
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
    if (!buildingPanel) return;
    
    if (state.phase !== "main" || !isCurrentPlayer()) {
      buildingPanel.classList.add("hidden");
      return;
    }
    
    buildingPanel.classList.remove("hidden");
    
    // Update button states
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
  }

  function renderState() {
    const info = $("gameInfoSection");
    const lobbySection = $("lobbySection");
    if (!state) {
      if (lobbySection) lobbySection.classList.remove("hidden");
      if (info) info.classList.add("hidden");
      renderLobby();
      return;
    }

    const res = $("resourcesSection");
    const log = $("logSection");
    const breachPanel = $("breachPanel");
    const buildingPanel = $("buildingPanel");

    // Hide rejoin banner when in-game (not in lobby)
    if (inGame() && state.phase !== "lobby") {
      hideRejoinBanner();
    }

    if (!inGame()) {
      console.log("[game] Not in game, showing create/join section");
      if (lobbySection) lobbySection.classList.remove("hidden");
      if (info) info.classList.add("hidden");
      if (res) res.classList.add("hidden");
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
      console.log("[game] Rendering lobby phase");
      if (lobbySection) lobbySection.classList.remove("hidden");
      if (info) info.classList.add("hidden");
      if (res) res.classList.add("hidden");
      if (log) log.classList.add("hidden");
      if (breachPanel) breachPanel.classList.add("hidden");
      if (buildingPanel) buildingPanel.classList.add("hidden");
      renderLobby();
      renderInventory();
      stopTimer();
      // Check for active game in lobby
      checkActiveGame();
      return;
    }

    // Game phase - show game UI
    lobbySection.classList.add("hidden");
    info.classList.remove("hidden");
    res.classList.remove("hidden");
    log.classList.remove("hidden");
    const gameTopbarGameId = $("gameTopbarGameId");
    const gameTimer = $("gameTimer");
    if (gameTopbarGameId) gameTopbarGameId.classList.add("hidden");
    if (gameTimer) gameTimer.classList.remove("hidden");
    
    // Ensure board renders
    if (state.board) {
      renderBoard();
    } else {
      console.warn("[game] Board not found in state, match may not have started");
      const boardEl = $("hexBoard");
      if (boardEl) {
        boardEl.innerHTML = "<p class=\"hex-board-placeholder\">Board will be generated when game starts…</p>";
      }
    }
    
    renderPlayers();
    renderDice();
    renderInventory();
    renderBreachPanel();
    renderBuildingPanel();

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
      }
    } else {
      if (rollBtn) rollBtn.classList.add("hidden");
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

  $("rollBtn").addEventListener("click", () => {
    if (!socket || !user) return;
    socket.emit("rollDice");
  });

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
