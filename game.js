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
      if (!r.ok) showError(r.error || "Create game failed");
    });

    socket.on("joinGameResult", (r) => {
      if (!r.ok) showError(r.error || "Join game failed");
    });

    socket.on("rollResult", () => {
      // Trigger dice roll animation
      const diceCards = document.querySelectorAll(".dice-card");
      diceCards.forEach(card => {
        card.classList.add("rolling");
        setTimeout(() => card.classList.remove("rolling"), 600);
      });
    });
  }

  function inGame() {
    return state && state.gameId;
  }

  function isCurrentPlayer() {
    return inGame() && user && state.currentTurnPlayerId === user.username;
  }

  function isCreator() {
    return inGame() && state.creatorId === user.username;
  }

  function isBarbarians() {
    return state && state.phase === "barbarians";
  }

  function hasActiveOffer() {
    return state && state.activeOffer;
  }

  function renderState() {
    if (!state) return;

    const info = $("gameInfoSection");
    const res = $("resourcesSection");
    const log = $("logSection");
    const offer = $("offerSection");

    if (!inGame()) {
      info.classList.add("hidden");
      res.classList.add("hidden");
      log.classList.add("hidden");
      offer.classList.add("hidden");
      return;
    }

    info.classList.remove("hidden");
    res.classList.remove("hidden");
    log.classList.remove("hidden");

    $("gameIdEl").textContent = state.gameId;
    $("phaseEl").textContent = state.phase;
    $("currentPlayerEl").textContent = state.players.find((p) => p.id === state.currentTurnPlayerId)?.name ?? "—";

    const lr = state.lastRoll;
    const lrEl = $("lastRollEl");
    const lrVal = $("lastRollVal");
    if (lr && (lr.d1 != null || lr.total != null)) {
      lrEl.classList.remove("hidden");
      let diceHTML = "";
      if (lr.d1 != null) {
        diceHTML = `<div class="dice-container">
          <div class="dice-card">${lr.d1}</div>
          <div class="dice-card">${lr.d2}</div>
        </div>`;
      }
      lrVal.innerHTML = diceHTML + `<div class="dice-result">Total: ${lr.total}${lr.isDouble ? " — Doubles!" : ""}</div>`;
    } else {
      lrEl.classList.add("hidden");
    }

    const lobby = state.phase === "lobby";
    const roll = state.phase === "roll";
    const main = state.phase === "main";

    const startBtn = $("startBtn");
    const rollBtn = $("rollBtn");
    const endTurnBtn = $("endTurnBtn");
    if (lobby && isCreator()) startBtn.classList.remove("hidden");
    else startBtn.classList.add("hidden");
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
        const myRes = (state.resources && state.resources[user.username]) || {};
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

  $("startBtn").addEventListener("click", () => {
    if (!socket || !user) return;
    socket.emit("startMatch");
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
