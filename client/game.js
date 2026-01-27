(function () {
  "use strict";

  const RESOURCES = ["stone", "iron", "food", "water", "gold", "people"]; // MVP: includes people for testing

  let user = null;
  let socket = null;
  let state = null;

  const $ = (id) => document.getElementById(id);

  function showError(msg) {
    const el = $("errorEl");
    el.textContent = msg;
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 5000);
  }

  function hideError() {
    $("errorEl").classList.add("hidden");
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
    if (user) {
      status.textContent = "Logged in as " + user.username;
      loginLink.classList.add("hidden");
      logoutBtn.classList.remove("hidden");
    } else {
      status.textContent = "Not logged in";
      loginLink.classList.remove("hidden");
      logoutBtn.classList.add("hidden");
    }
  }

  function fetchMe() {
    return fetch("/api/me", { credentials: "same-origin" }).then((r) => r.json());
  }

  function initAuth() {
    return fetchMe().then((data) => {
      console.log("[game] /api/me response:", data);
      if (!data.ok) {
        const errorMsg = "Authentication failed. Please try logging in again.";
        console.error("[game] /api/me failed:", errorMsg);
        showError(errorMsg);
        setTimeout(() => {
          window.location.href = "/login";
        }, 3000);
        return Promise.reject(new Error("Failed to fetch /api/me"));
      }
      user = data.user;
      if (!user) {
        console.log("[game] No user session, redirecting to login");
        showError("Not logged in. Redirecting to login...");
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
        return Promise.reject(new Error("redirect"));
      }
      console.log("[game] User authenticated:", user.username, "userId:", user.id);
      renderLoginStatus();
      // Check for active game after auth
      checkActiveGame();
    }).catch((err) => {
      console.error("[game] Auth initialization error:", err);
      if (err.message !== "redirect") {
        showError("Failed to authenticate. Please refresh the page or log in again.");
      }
    });
  }

  function checkActiveGame() {
    if (!user) return;
    fetch("/api/active-game", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => {
        console.log("[game] /api/active-game response:", data);
        if (data.ok && data.gameId) {
          console.log("[game] Active game found:", data.gameId);
          showRejoinBanner(data.gameId);
        } else {
          hideRejoinBanner();
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

  $("logoutBtn").addEventListener("click", () => {
    fetch("/api/logout", { method: "POST", credentials: "same-origin" })
      .then(() => {
        user = null;
        window.location.href = "/login";
      });
  });

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
      console.log("[game] gameState received:", s ? { gameId: s.gameId, phase: s.phase, playersCount: s.players?.length } : "null");
      state = s;
      renderState();
    });

    socket.on("createGameResult", (r) => {
      if (!r.ok) {
        showError(r.error || "Create game failed");
      } else {
        // Auto-switch to lobby view when game is created
        // The gameState event will handle the UI update
      }
    });

    socket.on("joinGameResult", (r) => {
      if (!r.ok) showError(r.error || "Join game failed");
    });

    socket.on("rollResult", (result) => {
      // Trigger dice roll animation
      const dice1 = $("dice1");
      const dice2 = $("dice2");
      if (dice1 && dice2) {
        dice1.classList.add("rolling");
        dice2.classList.add("rolling");
        // Update dice values during animation
        setTimeout(() => {
          if (result && result.roll) {
            dice1.textContent = result.roll.d1;
            dice2.textContent = result.roll.d2;
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
    return inGame() && state.creatorId === user.id;
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
    const lobbyPlayers = $("lobbyPlayers");
    const lobbyGameId = $("lobbyGameId");
    const lobbyGameIdText = $("lobbyGameIdText");
    const lobbyStartBtn = $("lobbyStartBtn");
    const startBtnLobby = $("startBtnLobby");
    const createJoinSection = lobbySection.querySelector(".game-actions");

    if (!inGame() || state.phase !== "lobby") {
      // Hide lobby elements but keep create/join section visible
      lobbyPlayers.classList.add("hidden");
      lobbyGameId.classList.add("hidden");
      lobbyStartBtn.classList.add("hidden");
      if (createJoinSection) createJoinSection.style.display = "";
      return;
    }

    // Show lobby UI - hide create/join section
    if (createJoinSection) createJoinSection.style.display = "none";
    lobbyPlayers.classList.remove("hidden");
    lobbyGameId.classList.remove("hidden");
    lobbyGameIdText.textContent = state.gameId;

    // Render player circles
    lobbyPlayers.innerHTML = "";
    (state.players || []).forEach((p) => {
      const isCreator = p.id === state.creatorId;
      const avatar = document.createElement("div");
      avatar.className = "player-avatar";
      avatar.innerHTML = `
        <div class="player-circle ${isCreator ? 'creator' : ''}" title="${escapeHtml(p.name)}">
          ${getInitials(p.name)}
        </div>
        <div class="player-name">${escapeHtml(p.name)}</div>
      `;
      lobbyPlayers.appendChild(avatar);
    });

    // Show Start Game button for creator
    if (isCreator()) {
      lobbyStartBtn.classList.remove("hidden");
    } else {
      lobbyStartBtn.classList.add("hidden");
    }
  }

  function renderInventory() {
    const inventoryBar = $("inventoryBar");
    const inventoryChips = $("inventoryChips");

    if (!inGame() || !user) {
      inventoryBar.classList.add("hidden");
      return;
    }

    inventoryBar.classList.remove("hidden");
    const myRes = (state.resources && state.resources[user.id]) || {};
    
    inventoryChips.innerHTML = "";
    RESOURCES.forEach((k) => {
      const count = myRes[k] || 0;
      const chip = document.createElement("div");
      chip.className = "inventory-chip" + (count > 0 ? " has-resource" : "");
      chip.innerHTML = `
        <span style="text-transform: capitalize;">${k}</span>
        <strong style="color: ${count > 0 ? 'var(--success)' : 'var(--muted)'};">${count}</strong>
      `;
      inventoryChips.appendChild(chip);
    });
  }

  function renderBoard() {
    const boardEl = $("hexBoard");
    if (!boardEl) {
      console.warn("[game] hexBoard element not found");
      return;
    }
    if (!state.board) {
      console.warn("[game] Board not generated yet");
      boardEl.innerHTML = "<p style='text-align: center; color: var(--muted);'>Board will be generated when game starts...</p>";
      return;
    }
    
    boardEl.innerHTML = "";
    
    state.board.tiles.forEach((tile) => {
      const hex = document.createElement("div");
      hex.className = "hex-tile";
      hex.dataset.tileId = tile.id;
      
      if (tile.id === state.board.blockedTileId) {
        hex.classList.add("blocked");
      }
      
      // Tile type icon/color
      const typeColors = {
        stone: "#8b8ba3",
        iron: "#6b7280",
        food: "#10b981",
        water: "#3b82f6",
        gold: "#f59e0b",
        people: "#ec4899", // MVP: pink for people tile
        market: "#8b5cf6"
      };
      
      hex.style.backgroundColor = typeColors[tile.type] || "#1a1a1f";
      
      // Tile type label
      const typeLabel = document.createElement("div");
      typeLabel.className = "hex-type";
      typeLabel.textContent = tile.type === "market" ? "Market" : tile.type[0].toUpperCase() + tile.type.slice(1);
      hex.appendChild(typeLabel);
      
      // Number token
      if (tile.number !== null) {
        const numberEl = document.createElement("div");
        numberEl.className = "hex-number";
        numberEl.textContent = tile.number;
        hex.appendChild(numberEl);
      }
      
      // Buildings
      const buildingsEl = document.createElement("div");
      buildingsEl.className = "hex-buildings";
      tile.buildings.forEach((building) => {
        const buildingEl = document.createElement("div");
        buildingEl.className = `building building-${building.type}`;
        buildingEl.title = building.type;
        const player = state.players.find(p => p.id === building.playerId);
        if (player) {
          buildingEl.textContent = getInitials(player.name);
        }
        buildingsEl.appendChild(buildingEl);
      });
      hex.appendChild(buildingsEl);
      
      // Click handler for building placement
      if (state.phase === "main" && isCurrentPlayer() && selectedBuildingType) {
        hex.classList.add("clickable");
        hex.addEventListener("click", () => {
          socket.emit("placeBuilding", { tileId: tile.id, buildingType: selectedBuildingType });
          selectedBuildingType = null;
          renderBuildingPanel();
        });
      }
      
      boardEl.appendChild(hex);
    });
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
        <div class="player-resources-mini">
          ${RESOURCES.map(k => {
            const count = r[k] || 0;
            return `<span class="resource-mini ${count > 0 ? 'has' : ''}">${k[0].toUpperCase()}:${count}</span>`;
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
      if (dice1) dice1.textContent = lr.d1;
      if (dice2) dice2.textContent = lr.d2;
      if (diceResult) {
        diceResult.classList.remove("hidden");
        diceResult.textContent = `Roll: ${lr.d1} + ${lr.d2} = ${lr.total}${lr.isDouble ? " (Doubles!)" : ""}`;
      }
    } else {
      if (dice1) dice1.textContent = "?";
      if (dice2) dice2.textContent = "?";
      if (diceResult) diceResult.classList.add("hidden");
    }
  }

  function renderBreachPanel() {
    const breachPanel = $("breachPanel");
    const tileSelection = $("tileSelection");
    
    if (!isBreach() || !isCurrentPlayer()) {
      if (breachPanel) breachPanel.classList.add("hidden");
      return;
    }
    
    if (breachPanel) breachPanel.classList.remove("hidden");
    if (!tileSelection) return;
    
    tileSelection.innerHTML = "";
    
    state.board.tiles.forEach((tile) => {
      if (tile.type === "market") return; // Can't block market
      
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
    if (!state) return;

    const info = $("gameInfoSection");
    const res = $("resourcesSection");
    const log = $("logSection");
    const lobbySection = $("lobbySection");
    const breachPanel = $("breachPanel");
    const buildingPanel = $("buildingPanel");

    if (!inGame()) {
      lobbySection.classList.remove("hidden");
      info.classList.add("hidden");
      res.classList.add("hidden");
      log.classList.add("hidden");
      if (breachPanel) breachPanel.classList.add("hidden");
      if (buildingPanel) buildingPanel.classList.add("hidden");
      renderLobby();
      renderInventory();
      stopTimer();
      return;
    }

    // Render lobby if in lobby phase
    if (state.phase === "lobby") {
      lobbySection.classList.remove("hidden");
      info.classList.add("hidden");
      res.classList.add("hidden");
      log.classList.add("hidden");
      if (breachPanel) breachPanel.classList.add("hidden");
      if (buildingPanel) buildingPanel.classList.add("hidden");
      renderLobby();
      renderInventory();
      stopTimer();
      return;
    }

    // Game phase - show game UI
    lobbySection.classList.add("hidden"); // Hide lobby
    info.classList.remove("hidden"); // Show game
    res.classList.remove("hidden");
    log.classList.remove("hidden");
    
    // Ensure board renders
    if (state.board) {
      renderBoard();
    } else {
      console.warn("[game] Board not found in state, match may not have started");
      const boardEl = $("hexBoard");
      if (boardEl) {
        boardEl.innerHTML = "<p style='text-align: center; color: var(--muted); padding: 40px;'>Board will be generated when game starts...</p>";
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
    
    if (breach && isCurrentPlayer()) {
      if (blockTileBtn) blockTileBtn.classList.remove("hidden");
    } else {
      if (blockTileBtn) blockTileBtn.classList.add("hidden");
    }

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
    if (!socket || !user) return;
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
