(function () {
  "use strict";

  const RESOURCES = ["stone", "iron", "food", "water", "gold"];

  let user = null;
  let socket = null;
  let state = null;
  let gameId = null;
  let timerInterval = null;
  let matchStartTime = null;
  const REJOIN_STORAGE_KEY = "rejoinGameId";

  const $ = (id) => document.getElementById(id);

  function setRejoinGameId(id) {
    if (id) sessionStorage.setItem(REJOIN_STORAGE_KEY, id);
  }

  // Get gameId from URL
  function getGameIdFromUrl() {
    const path = window.location.pathname;
    const match = path.match(/\/play\/([^\/]+)/);
    return match ? match[1] : null;
  }

  function showError(msg) {
    console.error("[play] Error:", msg);
    const el = $("errorEl");
    if (el) {
      el.textContent = msg;
      el.classList.remove("hidden");
      setTimeout(() => {
        if (el) el.classList.add("hidden");
      }, 5000);
    }
  }

  function hideError() {
    $("errorEl").classList.add("hidden");
  }

  function showReconnectOverlay() {
    const overlay = $("reconnectOverlay");
    if (overlay) {
      overlay.classList.remove("hidden");
    }
  }

  function hideReconnectOverlay() {
    const overlay = $("reconnectOverlay");
    if (overlay) {
      overlay.classList.add("hidden");
    }
  }

  $("backToLobbyBtn")?.addEventListener("click", () => {
    window.location.href = "/game";
  });

  function fetchMe() {
    return fetch("/api/me", { credentials: "same-origin" }).then((r) => r.json());
  }

  function initAuth() {
    return fetchMe().then((data) => {
      console.log("[play] /api/me response:", data);
      if (!data.ok) {
        const errorMsg = "Authentication failed. Please try logging in again.";
        console.error("[play] /api/me failed:", errorMsg);
        showError(errorMsg);
        setTimeout(() => {
          window.location.href = "/login";
        }, 3000);
        return Promise.reject(new Error("Failed to fetch /api/me"));
      }
      user = data.user;
      if (!user) {
        console.log("[play] No user session, redirecting to login");
        showError("Not logged in. Redirecting to login...");
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
        return Promise.reject(new Error("redirect"));
      }
      console.log("[play] User authenticated:", user.username, "userId:", user.id);
    }).catch((err) => {
      console.error("[play] Auth initialization error:", err);
      if (err.message !== "redirect") {
        showError("Failed to authenticate. Please refresh the page or log in again.");
      }
    });
  }

  // Logout button removed from play page - only in Settings tab

  $("copyGameIdBtn").addEventListener("click", () => {
    if (gameId) {
      navigator.clipboard.writeText(gameId).then(() => {
        const btn = $("copyGameIdBtn");
        const originalText = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => {
          btn.textContent = originalText;
        }, 2000);
      }).catch(() => {
        showError("Failed to copy Game ID");
      });
    }
  });

  function connectSocket() {
    console.log("[play] Connecting socket...");
    socket = io({ withCredentials: true });

    socket.on("connect", () => {
      console.log("[play] Socket connected:", socket.id);
      hideError();
      // Auto-join game when socket connects
      if (gameId) {
        console.log("[play] Emitting joinGame for:", gameId);
        socket.emit("joinGame", gameId);
      }
    });
    
    socket.on("disconnect", (reason) => {
      console.log("[play] Socket disconnected:", reason);
      if (state && state.gameId) {
        setRejoinGameId(state.gameId);
      }
      showReconnectOverlay();
    });
    
    socket.on("reconnect", () => {
      console.log("[play] Socket reconnected, attempting to rejoin game:", gameId);
      hideReconnectOverlay();
      hideError();
      if (gameId) {
        // Use rejoinGame instead of joinGame for better handling
        console.log("[play] Emitting rejoinGame for:", gameId);
        socket.emit("rejoinGame", gameId);
      }
    });

    socket.on("rejoinGameResult", (result) => {
      console.log("[play] rejoinGameResult:", result);
      if (result.ok) {
        console.log("[play] Successfully rejoined game");
        hideReconnectOverlay();
        hideError();
      } else {
        console.error("[play] Failed to rejoin:", result.error);
        showError(result.error || "Failed to rejoin game");
      }
    });

    socket.on("connect_error", (error) => {
      console.error("[play] Socket connect_error:", error);
      const errorMsg = "Connection failed. " + (error.message || "Ensure you are logged in and try refreshing the page.");
      showError(errorMsg);
      showReconnectOverlay();
      // On mobile, this might be a session issue
      if (navigator.userAgent.match(/Mobile|Android|iPhone|iPad/)) {
        console.error("[play] Mobile connection error - possible session/cookie issue");
        showError("Mobile connection failed. Please ensure cookies are enabled and try logging in again.");
      }
    });

    socket.on("error", (payload) => {
      showError(payload.message || "Error");
    });

    socket.on("gameState", (s) => {
      console.log("[play] Received gameState:", s?.phase, s?.gameId);
      state = s;
      renderState();
    });

    socket.on("joinGameResult", (r) => {
      console.log("[play] joinGameResult:", r);
      if (!r.ok) {
        const errorMsg = r.error || "Failed to join game";
        console.error("[play] Join failed:", errorMsg);
        showError(errorMsg);
        // Only redirect if it's a critical error (not just "already started" for existing players)
        if (errorMsg.includes("not found") || errorMsg.includes("not a member")) {
          setTimeout(() => {
            window.location.href = "/game";
          }, 5000);
        }
      } else {
        gameId = r.gameId || gameId;
        $("gameIdDisplay").textContent = gameId;
        console.log("[play] Successfully joined game:", gameId);
      }
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

  function isCurrentPlayer() {
    return state && user && state.currentTurnPlayerId === user.id;
  }

  function renderDice() {
    const diceContainer = $("diceContainer");
    const dice1 = $("dice1");
    const dice2 = $("dice2");
    const diceResult = $("diceResult");
    const rollBtn = $("rollBtn");
    const endTurnBtn = $("endTurnBtn");

    if (!state) {
      // Show placeholder while loading
      if (diceContainer) diceContainer.classList.remove("hidden");
      if (dice1) dice1.textContent = "?";
      if (dice2) dice2.textContent = "?";
      if (diceResult) diceResult.classList.add("hidden");
      if (rollBtn) rollBtn.classList.add("hidden");
      if (endTurnBtn) endTurnBtn.classList.add("hidden");
      return;
    }

    // Always show dice container once we have state
    if (diceContainer) diceContainer.classList.remove("hidden");
    
    // If still in lobby, show waiting message
    if (state.phase === "lobby") {
      if (dice1) dice1.textContent = "?";
      if (dice2) dice2.textContent = "?";
      if (diceResult) diceResult.classList.add("hidden");
      if (rollBtn) rollBtn.classList.add("hidden");
      if (endTurnBtn) endTurnBtn.classList.add("hidden");
      return;
    }

    const lr = state.lastRoll;
    if (lr && lr.d1 != null) {
      if (dice1) dice1.textContent = lr.d1;
      if (dice2) dice2.textContent = lr.d2;
      if (diceResult) {
        diceResult.classList.remove("hidden");
        diceResult.textContent = `Last roll: ${lr.d1} + ${lr.d2} = ${lr.total}${lr.isDouble ? " (Doubles!)" : ""}`;
      }
    } else {
      if (dice1) dice1.textContent = "?";
      if (dice2) dice2.textContent = "?";
      if (diceResult) diceResult.classList.add("hidden");
    }

    // Show buttons based on phase and current player
    const roll = state.phase === "roll";
    const main = state.phase === "main";
    if (rollBtn) {
      if (roll && isCurrentPlayer()) {
        rollBtn.classList.remove("hidden");
      } else {
        rollBtn.classList.add("hidden");
      }
    }
    if (endTurnBtn) {
      if (main && isCurrentPlayer()) {
        endTurnBtn.classList.remove("hidden");
      } else {
        endTurnBtn.classList.add("hidden");
      }
    }
  }

  function renderPlayerList() {
    const playerList = $("playerList");
    if (!state || !state.players) {
      playerList.innerHTML = "";
      return;
    }

    playerList.innerHTML = "";
    state.players.forEach((p) => {
      const isCurrent = p.id === state.currentTurnPlayerId;
      const playerItem = document.createElement("div");
      playerItem.className = "player-list-item" + (isCurrent ? " current" : "");
      playerItem.innerHTML = `
        <div class="player-list-avatar">${getInitials(p.name)}</div>
        <div class="player-list-info">
          <div class="player-list-name">${escapeHtml(p.name)}</div>
          ${isCurrent ? '<div class="player-list-status">Current Turn</div>' : ''}
        </div>
      `;
      playerList.appendChild(playerItem);
    });
  }

  function renderInventory() {
    const inventoryBar = $("inventoryBar");
    const inventoryChips = $("inventoryChips");

    if (!state || !user) {
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

  function startTimer(startTime) {
    if (timerInterval) clearInterval(timerInterval);
    matchStartTime = startTime || Date.now();
    
    function updateTimer() {
      if (!matchStartTime) return;
      const elapsed = Math.floor((Date.now() - matchStartTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      const timerDisplay = $("timerDisplay");
      if (timerDisplay) {
        timerDisplay.textContent = `Time: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
    }
    
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function renderState() {
    if (!state) return;

    $("gameIdDisplay").textContent = state.gameId || gameId || "—";

    // Start timer when match starts
    if (state.phase !== "lobby") {
      if (state.matchStartTime && !matchStartTime) {
        matchStartTime = state.matchStartTime;
        startTimer(matchStartTime);
      } else if (!state.matchStartTime && !matchStartTime) {
        // Fallback: start timer from now if server doesn't provide start time
        startTimer();
      }
    } else {
      stopTimer();
      matchStartTime = null;
      const timerDisplay = $("timerDisplay");
      if (timerDisplay) timerDisplay.textContent = "Time: 00:00";
    }

    renderDice();
    renderPlayerList();
    renderInventory();
  }

  function getInitials(username) {
    if (!username) return "?";
    const parts = username.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
    }
    return username.slice(0, 2).toUpperCase();
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  $("rollBtn").addEventListener("click", () => {
    if (!socket || !user) return;
    socket.emit("rollDice");
  });

  $("endTurnBtn").addEventListener("click", () => {
    if (!socket || !user) return;
    socket.emit("endTurn");
  });

  // Initialize
  gameId = getGameIdFromUrl();
  if (!gameId) {
    console.error("[play] No gameId in URL");
    showError("Invalid game ID in URL");
    setTimeout(() => {
      window.location.href = "/game";
    }, 2000);
    return;
  }

  console.log("[play] Initializing with gameId:", gameId);
  $("gameIdDisplay").textContent = gameId;
  
  // Show dice container immediately (will update when state arrives)
  const diceContainer = $("diceContainer");
  if (diceContainer) {
    diceContainer.classList.remove("hidden");
  }

  initAuth()
    .then(() => {
      console.log("[play] Auth successful, connecting socket...");
      connectSocket();
    })
    .catch((e) => {
      console.error("[play] Auth failed:", e);
      if (e.message !== "redirect") showError(e.message || "Auth failed");
    });

  window.addEventListener("beforeunload", () => {
    if (state && state.gameId) {
      setRejoinGameId(state.gameId);
    }
  });
})();
