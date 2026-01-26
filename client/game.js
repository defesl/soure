(function () {
  "use strict";

  const RESOURCES = ["clay", "flint", "sand", "water", "cattle", "people"];

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
      if (!data.ok) return Promise.reject(new Error("Failed to fetch /api/me"));
      user = data.user;
      if (!user) {
        window.location.href = "/login";
        return Promise.reject(new Error("redirect"));
      }
      renderLoginStatus();
    });
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

    socket.on("connect", () => hideError());

    socket.on("connect_error", () => {
      showError("Connection failed. Ensure you are logged in.");
    });

    socket.on("error", (payload) => {
      showError(payload.message || "Error");
    });

    socket.on("gameState", (s) => {
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

  function isBarbarians() {
    return state && state.phase === "barbarians";
  }

  function hasActiveOffer() {
    return state && state.activeOffer;
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

  function renderDice() {
    const diceContainer = $("diceContainer");
    const dice1 = $("dice1");
    const dice2 = $("dice2");
    const diceResult = $("diceResult");

    if (!inGame() || state.phase === "lobby") {
      diceContainer.classList.add("hidden");
      diceResult.classList.add("hidden");
      return;
    }

    diceContainer.classList.remove("hidden");
    
    const lr = state.lastRoll;
    if (lr && lr.d1 != null) {
      dice1.textContent = lr.d1;
      dice2.textContent = lr.d2;
      diceResult.classList.remove("hidden");
      diceResult.textContent = `Last roll: ${lr.d1} + ${lr.d2} = ${lr.total}${lr.isDouble ? " (Doubles!)" : ""}`;
    } else {
      dice1.textContent = "?";
      dice2.textContent = "?";
      diceResult.classList.add("hidden");
    }
  }

  function renderState() {
    if (!state) return;

    const info = $("gameInfoSection");
    const res = $("resourcesSection");
    const log = $("logSection");
    const offer = $("offerSection");
    const lobbySection = $("lobbySection");

    if (!inGame()) {
      info.classList.add("hidden");
      res.classList.add("hidden");
      log.classList.add("hidden");
      offer.classList.add("hidden");
      renderLobby();
      renderInventory();
      return;
    }

    // Render lobby if in lobby phase
    if (state.phase === "lobby") {
      info.classList.add("hidden");
      res.classList.add("hidden");
      log.classList.add("hidden");
      offer.classList.add("hidden");
      renderLobby();
      renderInventory();
      return;
    }

    // Game phase - show game UI
    info.classList.remove("hidden");
    res.classList.remove("hidden");
    log.classList.remove("hidden");
    renderLobby(); // This will hide lobby elements
    renderDice();
    renderInventory();

    $("gameIdEl").textContent = state.gameId;
    $("phaseEl").textContent = state.phase;
    $("currentPlayerEl").textContent = state.players.find((p) => p.id === state.currentTurnPlayerId)?.name ?? "—";

    const roll = state.phase === "roll";
    const main = state.phase === "main";

    const rollBtn = $("rollBtn");
    const endTurnBtn = $("endTurnBtn");
    if (roll && isCurrentPlayer()) rollBtn.classList.remove("hidden");
    else rollBtn.classList.add("hidden");
    if (main && isCurrentPlayer()) endTurnBtn.classList.remove("hidden");
    else endTurnBtn.classList.add("hidden");

    const grid = $("resourcesGrid");
    grid.innerHTML = "";
    (state.players || []).forEach((p) => {
      const r = (state.resources && state.resources[p.id]) || {};
      const isCurrent = p.id === state.currentTurnPlayerId;
      const div = document.createElement("div");
      div.className = "player-card" + (isCurrent ? " current" : "");
      let str = "<strong style='display: block; margin-bottom: 12px; font-size: 1.1rem;'>" + escapeHtml(p.name) + "</strong><div style='display: flex; flex-wrap: wrap; gap: 10px;'>";
      RESOURCES.forEach((k) => {
        const count = r[k] || 0;
        const chipClass = count > 0 ? "resource-chip success" : "resource-chip";
        str += `<div class="${chipClass}"><span style='text-transform: capitalize;'>${k}</span><strong style='font-size: 1.2rem; color: var(--accent);'>${count}</strong></div>`;
      });
      str += "</div>";
      div.innerHTML = str;
      grid.appendChild(div);
    });

    const logEl = $("eventLog");
    logEl.innerHTML = "";
    (state.eventLog || []).forEach((e) => {
      const d = document.createElement("div");
      d.textContent = e.msg || "";
      logEl.appendChild(d);
    });
    logEl.scrollTop = logEl.scrollHeight;

    if (isBarbarians()) {
      offer.classList.remove("hidden");
      const oc = $("offerCurrent");
      const oo = $("offerOthers");
      if (isCurrentPlayer()) {
        oc.classList.remove("hidden");
        oo.classList.add("hidden");
      } else {
        oc.classList.add("hidden");
        oo.classList.toggle("hidden", !hasActiveOffer());
      }
      $("offerDesc").textContent = hasActiveOffer()
        ? "Current player offers: place barbarians in camp in exchange for 1 " + (state.activeOffer.request === "any" ? "resource" : state.activeOffer.request) + "."
        : "Barbarians activated. Current player can create an offer or place in camp.";

      const acceptDiv = $("acceptButtons");
      acceptDiv.innerHTML = "";
      if (!isCurrentPlayer() && hasActiveOffer()) {
        const myRes = (state.resources && state.resources[user.id]) || {};
        const want = state.activeOffer.request;
        RESOURCES.forEach((k) => {
          if ((want === "any" || want === k) && (myRes[k] || 0) >= 1) {
            const b = document.createElement("button");
            b.className = "btn";
            b.textContent = "Give 1 " + k;
            b.addEventListener("click", () => socket.emit("acceptOffer", k));
            acceptDiv.appendChild(b);
          }
        });
      }
    } else {
      offer.classList.add("hidden");
    }
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
    if (!socket || !user || !state) return;
    const currentGameId = state.gameId;
    socket.emit("startMatch");
    // Redirect to play page when match starts
    const redirectHandler = (newState) => {
      if (newState && newState.gameId === currentGameId && newState.phase !== "lobby") {
        socket.off("gameState", redirectHandler);
        window.location.href = `/play/${newState.gameId}`;
      }
    };
    socket.on("gameState", redirectHandler);
    // Fallback: check current state after a short delay
    setTimeout(() => {
      if (state && state.phase !== "lobby" && state.gameId) {
        socket.off("gameState", redirectHandler);
        window.location.href = `/play/${state.gameId}`;
      }
    }, 500);
  });

  $("rollBtn").addEventListener("click", () => {
    if (!socket || !user) return;
    socket.emit("rollDice");
  });

  $("endTurnBtn").addEventListener("click", () => {
    if (!socket || !user) return;
    socket.emit("endTurn");
  });

  $("createOfferBtn").addEventListener("click", () => {
    if (!socket || !user) return;
    const request = $("offerRequest").value || "any";
    socket.emit("createOffer", { request });
  });

  $("placeCampBtn").addEventListener("click", () => {
    if (!socket || !user) return;
    socket.emit("placeInCamp");
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
