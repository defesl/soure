(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const API = "/api/friends";
  const opts = { credentials: "same-origin", headers: { "Content-Type": "application/json" } };

  function showMessage(el, text, isError) {
    if (!el) return;
    el.textContent = text;
    el.classList.remove("hidden", "friends-message-error", "friends-message-success");
    el.classList.add(isError ? "friends-message-error" : "friends-message-success");
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 4000);
  }

  function setLoading(button, loading) {
    if (!button) return;
    button.disabled = loading;
    button.textContent = loading ? "…" : (button.dataset.label || button.textContent);
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  // ——— Auth ———
  function checkAuth() {
    return fetch("/api/me", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.user) {
          $("friendsLoginRequired").classList.add("hidden");
          $("friendsContent").classList.remove("hidden");
          return data.user;
        }
        $("friendsLoginRequired").classList.remove("hidden");
        $("friendsContent").classList.add("hidden");
        return null;
      })
      .catch(() => {
        $("friendsLoginRequired").classList.remove("hidden");
        $("friendsContent").classList.add("hidden");
        return null;
      });
  }

  // ——— Load lists ———
  function loadIncoming() {
    const list = $("incomingList");
    const empty = $("incomingEmpty");
    if (!list || !empty) return;
    fetch(API + "/requests/incoming", { credentials: "same-origin" })
      .then((r) => (r.status === 401 ? null : r.json()))
      .then((data) => {
        if (!data || !data.ok) {
          list.innerHTML = "";
          empty.classList.remove("hidden");
          return;
        }
        const requests = data.requests || [];
        empty.classList.toggle("hidden", requests.length > 0);
        list.innerHTML = requests
          .map(
            (r) => `
          <div class="friends-card" data-request-id="${escapeHtml(r.id)}">
            <div class="friends-card-user">
              <span class="friends-avatar" aria-hidden="true">${escapeHtml((r.fromUsername || "").slice(0, 2).toUpperCase())}</span>
              <span class="friends-username">${escapeHtml(r.fromUsername || "")}</span>
            </div>
            <div class="friends-card-actions">
              <button type="button" class="btn btn-primary friends-btn-accept" data-request-id="${escapeHtml(r.id)}" aria-label="Accept request">Accept</button>
              <button type="button" class="btn friends-btn-reject" data-request-id="${escapeHtml(r.id)}" aria-label="Reject request">Reject</button>
            </div>
          </div>`
          )
          .join("");
        list.querySelectorAll(".friends-btn-accept").forEach((btn) => {
          btn.addEventListener("click", () => acceptRequest(btn.dataset.requestId));
        });
        list.querySelectorAll(".friends-btn-reject").forEach((btn) => {
          btn.addEventListener("click", () => rejectRequest(btn.dataset.requestId));
        });
      })
      .catch(() => {
        list.innerHTML = "";
        empty.classList.remove("hidden");
      });
  }

  function loadOutgoing() {
    const list = $("outgoingList");
    const empty = $("outgoingEmpty");
    if (!list || !empty) return;
    fetch(API + "/requests/outgoing", { credentials: "same-origin" })
      .then((r) => (r.status === 401 ? null : r.json()))
      .then((data) => {
        if (!data || !data.ok) {
          list.innerHTML = "";
          empty.classList.remove("hidden");
          return;
        }
        const requests = data.requests || [];
        empty.classList.toggle("hidden", requests.length > 0);
        list.innerHTML = requests
          .map(
            (r) => `
          <div class="friends-card" data-request-id="${escapeHtml(r.id)}">
            <div class="friends-card-user">
              <span class="friends-avatar" aria-hidden="true">${escapeHtml((r.toUsername || "").slice(0, 2).toUpperCase())}</span>
              <span class="friends-username">${escapeHtml(r.toUsername || "")}</span>
              <span class="friends-status">Pending</span>
            </div>
            <button type="button" class="btn friends-btn-cancel" data-request-id="${escapeHtml(r.id)}" aria-label="Cancel request">Cancel</button>
          </div>`
          )
          .join("");
        list.querySelectorAll(".friends-btn-cancel").forEach((btn) => {
          btn.addEventListener("click", () => cancelRequest(btn.dataset.requestId));
        });
      })
      .catch(() => {
        list.innerHTML = "";
        empty.classList.remove("hidden");
      });
  }

  function loadFriendsList() {
    const list = $("friendsList");
    const empty = $("friendsListEmpty");
    if (!list || !empty) return;
    fetch(API + "/list", { credentials: "same-origin" })
      .then((r) => (r.status === 401 ? null : r.json()))
      .then((data) => {
        if (!data || !data.ok) {
          list.innerHTML = "";
          empty.classList.remove("hidden");
          return;
        }
        const friends = data.friends || [];
        empty.classList.toggle("hidden", friends.length > 0);
        list.innerHTML = friends
          .map(
            (f) => {
              const since = f.friendsSince ? new Date(f.friendsSince).toLocaleDateString() : "";
              return `
          <div class="friends-card" data-user-id="${escapeHtml(f.id)}">
            <div class="friends-card-user">
              <span class="friends-avatar" aria-hidden="true">${escapeHtml((f.username || "").slice(0, 2).toUpperCase())}</span>
              <div>
                <span class="friends-username">${escapeHtml(f.username || "")}</span>
                ${since ? `<span class="friends-since">Friends since ${escapeHtml(since)}</span>` : ""}
              </div>
            </div>
            <button type="button" class="btn btn-danger friends-btn-remove" data-user-id="${escapeHtml(f.id)}" aria-label="Remove friend">Remove</button>
          </div>`;
            }
          )
          .join("");
        list.querySelectorAll(".friends-btn-remove").forEach((btn) => {
          btn.addEventListener("click", () => removeFriend(btn.dataset.userId));
        });
      })
      .catch(() => {
        list.innerHTML = "";
        empty.classList.remove("hidden");
      });
  }

  function refreshAll() {
    loadIncoming();
    loadOutgoing();
    loadFriendsList();
  }

  // ——— Actions ———
  function sendRequest() {
    const input = $("friendUsername");
    const btn = $("sendRequestBtn");
    const msg = $("friendsAddMessage");
    const username = input && input.value ? input.value.trim() : "";
    if (!username) {
      showMessage(msg, "Enter a username", true);
      return;
    }
    if (!btn) return;
    btn.dataset.label = btn.textContent;
    setLoading(btn, true);
    fetch(API + "/request", {
      ...opts,
      method: "POST",
      body: JSON.stringify({ username }),
    })
      .then((r) => r.json())
      .then((data) => {
        setLoading(btn, false);
        if (data.ok) {
          showMessage(msg, "Request sent.", false);
          if (input) input.value = "";
          refreshAll();
        } else {
          showMessage(msg, data.error || "Failed to send request", true);
        }
      })
      .catch(() => {
        setLoading(btn, false);
        showMessage(msg, "Network error. Try again.", true);
      });
  }

  function acceptRequest(requestId) {
    const btn = document.querySelector(`.friends-btn-accept[data-request-id="${requestId}"]`);
    if (btn) setLoading(btn, true);
    fetch(API + "/accept", { ...opts, method: "POST", body: JSON.stringify({ requestId }) })
      .then((r) => r.json())
      .then((data) => {
        if (btn) setLoading(btn, false);
        if (data.ok) refreshAll();
        else if (data.error) showMessage($("friendsAddMessage"), data.error, true);
      })
      .catch(() => {
        if (btn) setLoading(btn, false);
        refreshAll();
      });
  }

  function rejectRequest(requestId) {
    const btn = document.querySelector(`.friends-btn-reject[data-request-id="${requestId}"]`);
    if (btn) setLoading(btn, true);
    fetch(API + "/reject", { ...opts, method: "POST", body: JSON.stringify({ requestId }) })
      .then((r) => r.json())
      .then((data) => {
        if (btn) setLoading(btn, false);
        if (data.ok) refreshAll();
      })
      .catch(() => {
        if (btn) setLoading(btn, false);
        refreshAll();
      });
  }

  function cancelRequest(requestId) {
    const btn = document.querySelector(`.friends-btn-cancel[data-request-id="${requestId}"]`);
    if (btn) setLoading(btn, true);
    fetch(API + "/cancel", { ...opts, method: "POST", body: JSON.stringify({ requestId }) })
      .then((r) => r.json())
      .then((data) => {
        if (btn) setLoading(btn, false);
        if (data.ok) refreshAll();
      })
      .catch(() => {
        if (btn) setLoading(btn, false);
        refreshAll();
      });
  }

  function removeFriend(userId) {
    const btn = document.querySelector(`.friends-btn-remove[data-user-id="${userId}"]`);
    if (btn) setLoading(btn, true);
    fetch(API + "/remove", { ...opts, method: "POST", body: JSON.stringify({ userId }) })
      .then((r) => r.json())
      .then((data) => {
        if (btn) setLoading(btn, false);
        if (data.ok) refreshAll();
      })
      .catch(() => {
        if (btn) setLoading(btn, false);
        refreshAll();
      });
  }

  // ——— Init ———
  checkAuth().then((user) => {
    if (user) {
      refreshAll();
      const sendBtn = $("sendRequestBtn");
      if (sendBtn) sendBtn.addEventListener("click", sendRequest);
      const input = $("friendUsername");
      if (input) input.addEventListener("keydown", (e) => { if (e.key === "Enter") sendRequest(); });
    }
  });
})();
