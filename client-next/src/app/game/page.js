"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getMe } from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { TRACK } from "@/lib/track";

const RESOURCES = ["stone", "iron", "food", "water", "gold"];
const TRACK_TOP = ["cell-top-0", "cell-top-1", "cell-top-2", "cell-top-3", "cell-top-4", "cell-top-5", "cell-top-6"];
const TRACK_RIGHT = ["cell-right-0", "cell-right-1", "cell-right-2", "cell-right-3"];
const TRACK_BOTTOM = ["cell-bottom-6", "cell-bottom-5", "cell-bottom-4", "cell-bottom-3", "cell-bottom-2", "cell-bottom-1", "cell-bottom-0"];
const TRACK_LEFT = ["cell-left-3", "cell-left-2", "cell-left-1", "cell-left-0"];

function formatResourceLabel(resourceType) {
  if (!resourceType) return "";
  return resourceType[0].toUpperCase() + resourceType.slice(1);
}

function getInitials(username) {
  if (!username) return "?";
  const parts = username.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  }
  return username.slice(0, 2).toUpperCase();
}

export default function GamePage() {
  const searchParams = useSearchParams();
  const rejoinGameId = searchParams.get("gameId");
  const [user, setUser] = useState(undefined);
  const [state, setState] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [tokens, setTokens] = useState([]);
  const [now, setNow] = useState(Date.now());
  const socketRef = useRef(null);
  const boardRef = useRef(null);
  const tokenLayerRef = useRef(null);
  const logRef = useRef(null);
  const apiBase = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000",
    []
  );

  useEffect(() => {
    let active = true;
    getMe()
      .then((data) => {
        if (!active) return;
        setUser(data?.user || null);
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const socket = connectSocket();
    socketRef.current = socket;

    socket.on("connect", () => {
      setErrorMsg("");
      if (rejoinGameId) {
        socket.emit("rejoinGame", rejoinGameId);
      }
    });

    socket.on("connect_error", (error) => {
      setErrorMsg(`Connection failed. ${error?.message || "Ensure you are logged in and refresh."}`);
    });

    socket.on("error", (payload) => {
      setErrorMsg(payload?.message || "Unexpected error");
    });

    socket.on("gameState", (nextState) => {
      setState(nextState || null);
    });

    return () => {
      socket.disconnect();
    };
  }, [user, rejoinGameId]);

  useEffect(() => {
    if (!state?.matchStartTime) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state?.matchStartTime]);

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [state?.eventLog]);

  const computeTokens = useCallback(() => {
    const board = boardRef.current;
    const tokenLayer = tokenLayerRef.current;
    if (!board || !tokenLayer || !state?.players?.length) {
      setTokens([]);
      return;
    }

    const track = state?.track?.length ? state.track : TRACK;
    const trackLen = track.length;
    const tokenPosByPlayerId = state.tokenPosByPlayerId || {};
    const tokenStyleByPlayerId = state.tokenStyleByPlayerId || {};
    const players = state.players || [];
    const tokenSize = 18;
    const offsetStep = 10;

    const byPos = {};
    const items = players.map((player) => {
      const pos = Math.max(0, Math.min(trackLen - 1, tokenPosByPlayerId[player.id] ?? 0));
      const style = tokenStyleByPlayerId[player.id] || { shape: "circle", color: "#8b5cf6" };
      if (!byPos[pos]) byPos[pos] = [];
      byPos[pos].push(player.id);
      return { player, pos, style };
    });

    const layerRect = (board || tokenLayer).getBoundingClientRect();
    const nextTokens = items
      .map((item) => {
        const anchor = board.querySelector(`.track-tile[data-tile-index="${item.pos}"]`);
        if (!anchor) return null;
        const offsetIndex = byPos[item.pos].indexOf(item.player.id);
        const offsetX = (offsetIndex % 2) * offsetStep;
        const offsetY = Math.floor(offsetIndex / 2) * offsetStep;
        const anchorRect = anchor.getBoundingClientRect();
        const left = anchorRect.left - layerRect.left + (anchorRect.width - tokenSize) / 2 + offsetX;
        const top = anchorRect.top - layerRect.top + (anchorRect.height - tokenSize) / 2 + offsetY;
        return {
          id: item.player.id,
          shape: item.style.shape,
          color: item.style.color,
          left,
          top,
        };
      })
      .filter(Boolean);

    setTokens(nextTokens);
  }, [state]);

  useEffect(() => {
    computeTokens();
  }, [computeTokens]);

  useEffect(() => {
    if (!state?.players?.length) return undefined;
    window.addEventListener("resize", computeTokens);
    return () => window.removeEventListener("resize", computeTokens);
  }, [state?.players?.length, computeTokens]);

  const track = state?.track?.length ? state.track : TRACK;
  const trackByDomId = useMemo(() => {
    const byId = {};
    const byIndex = {};
    track.forEach((cell, i) => {
      byId[cell.domId] = cell;
      byIndex[cell.domId] = cell.index != null ? cell.index : i;
    });
    return { byId, byIndex };
  }, [track]);

  const inGame = !!state?.gameId;
  const isLobby = state?.phase === "lobby";
  const isEnded = state?.phase === "ended";
  const showLobby = !inGame || isLobby || isEnded;
  const showGame = inGame && !isLobby && !isEnded;
  const currentUserResources = user && state?.resources ? state.resources[user.id] || {} : {};
  const timerText = useMemo(() => {
    if (!state?.matchStartTime) return null;
    const elapsed = Math.floor((now - state.matchStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `Time: ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [now, state?.matchStartTime]);
  const cornerColors = useMemo(() => {
    const colors = [null, null, null, null];
    (state?.players || []).forEach((player) => {
      if (player.cornerIndex != null && player.color) {
        colors[player.cornerIndex] = player.color;
      }
    });
    return colors;
  }, [state?.players]);

  if (user === undefined) {
    return null;
  }

  if (user === null) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: "center" }}>
          <h2 style={{ marginTop: 0 }}>Log in required</h2>
          <p className="helper">Please log in to join a game.</p>
          <a className="btn btn-primary" href={`${apiBase}/login`}>
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="game-page">
      <header className="game-topbar hud-top-bar">
        <div className="game-topbar-left">
          <a href="/" className="game-back-btn" aria-label="Back to menu">
            ← Back to Menu
          </a>
          <span className="game-topbar-sep" aria-hidden="true">
            |
          </span>
          <span className={`game-topbar-gameid ${showGame ? "hidden" : ""}`}>
            Game ID: {state?.gameId || "—"}
          </span>
          <span className={`game-timer ${showGame && timerText ? "" : "hidden"}`}>
            {timerText || "Time: 00:00"}
          </span>
        </div>
        <div className={`resource-bar ${showGame ? "" : "hidden"}`} aria-label="My resources">
          {RESOURCES.map((key) => {
            const count = currentUserResources[key] || 0;
            const name = key[0].toUpperCase() + key.slice(1);
            return (
              <div
                className={`inventory-chip ${count > 0 ? "has-resource" : ""}`}
                key={key}
              >
                <img
                  className="resource-icon"
                  src={`${apiBase}/assets/resources/${key}.png`}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <span style={{ textTransform: "capitalize" }}>{name}</span>
                <strong style={{ color: count > 0 ? "var(--success)" : "var(--muted)" }}>
                  {count}
                </strong>
              </div>
            );
          })}
        </div>
      </header>

      <div className="game-container">
        <section className={`game-lobby ${showLobby ? "" : "hidden"}`} aria-label="Lobby">
          <div className={`game-ended-inactive ${isEnded ? "" : "hidden"}`} role="status">
            <p className="game-ended-msg">
              Game ended (inactive — no dice roll within 2 minutes).
            </p>
            <a href="/" className="btn btn-primary">
              Back to menu
            </a>
          </div>
          <div className="game-lobby-create lobby-toolbar" aria-hidden={isEnded}>
            <label className="lobby-toolbar-label">Game ID</label>
            <input
              type="text"
              className="input lobby-toolbar-input"
              placeholder="Enter Game ID"
              aria-label="Game ID to join"
              disabled
            />
            <button type="button" className="btn btn-primary" disabled>
              Create Game
            </button>
            <button type="button" className="btn" disabled>
              Join Game
            </button>
          </div>
          <div className={`game-lobby-room ${isLobby && state ? "" : "hidden"}`}>
            <div className="game-lobby-slots" role="list" aria-label="Player slots">
              {Array.from({ length: 4 }).map((_, idx) => {
                const player = state?.players?.[idx];
                if (!player) {
                  return (
                    <div className="game-lobby-slot empty" role="listitem" key={idx}>
                      <div className="player-circle player-circle-empty" aria-hidden="true" />
                      <div className="player-name" aria-hidden="true">
                        —
                      </div>
                    </div>
                  );
                }
                const isCreator = player.id === state.creatorId;
                return (
                  <div className="game-lobby-slot filled" role="listitem" key={player.id}>
                    <div className={`player-circle ${isCreator ? "creator" : ""}`}>
                      {getInitials(player.name)}
                    </div>
                    <div className="player-name">{player.name}</div>
                  </div>
                );
              })}
            </div>
            <div className="game-lobby-start-wrap">
              <button type="button" className="btn btn-lobby-start" disabled>
                Start Game
              </button>
            </div>
          </div>
        </section>

        <section className={`game-section ${showGame ? "" : "hidden"}`} id="gameInfoSection">
          <div className="game-hud">
            <div className="hud-body game-play-area">
              <aside className="hud-left" aria-label="Players">
                <div className="players-list">
                  {(state?.players || []).map((player) => (
                    <div
                      key={player.id}
                      className={`player-card ${
                        player.id === state?.currentTurnPlayerId ? "current" : ""
                      }`}
                    >
                      <div className="player-card-header">
                        <div className="player-name">
                          <span
                            className="player-color-dot"
                            style={{ background: player.color || "var(--muted)" }}
                          />
                          <strong>{player.name}</strong>
                        </div>
                        {player.id === state?.currentTurnPlayerId && (
                          <span className="current-badge">Current</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </aside>

              <main className="hud-center" aria-label="Board">
                <div className="board-container">
                  <div className="soure-board" ref={boardRef} role="img" aria-label="Game board">
                    <div
                      className="corner corner-tl"
                      style={
                        cornerColors[0]
                          ? { borderColor: cornerColors[0], boxShadow: `0 0 12px ${cornerColors[0]}` }
                          : undefined
                      }
                      aria-hidden="true"
                    />
                    <div
                      className="corner corner-tr"
                      style={
                        cornerColors[1]
                          ? { borderColor: cornerColors[1], boxShadow: `0 0 12px ${cornerColors[1]}` }
                          : undefined
                      }
                      aria-hidden="true"
                    />
                    <div
                      className="corner corner-bl"
                      style={
                        cornerColors[3]
                          ? { borderColor: cornerColors[3], boxShadow: `0 0 12px ${cornerColors[3]}` }
                          : undefined
                      }
                      aria-hidden="true"
                    />
                    <div
                      className="corner corner-br"
                      style={
                        cornerColors[2]
                          ? { borderColor: cornerColors[2], boxShadow: `0 0 12px ${cornerColors[2]}` }
                          : undefined
                      }
                      aria-hidden="true"
                    />

                    <div className="track top">
                      {TRACK_TOP.map((domId) => {
                        const cell = trackByDomId.byId[domId];
                        const index = trackByDomId.byIndex[domId] ?? 0;
                        return (
                          <div
                            key={domId}
                            className="track-slot track-tile"
                            id={domId}
                            data-tile-index={index}
                          >
                            <div className="slot-label">{formatResourceLabel(cell?.resourceType)}</div>
                            <div className="slot-meta" />
                          </div>
                        );
                      })}
                    </div>
                    <div className="track right">
                      {TRACK_RIGHT.map((domId) => {
                        const cell = trackByDomId.byId[domId];
                        const index = trackByDomId.byIndex[domId] ?? 0;
                        return (
                          <div
                            key={domId}
                            className="track-slot track-tile"
                            id={domId}
                            data-tile-index={index}
                          >
                            <div className="slot-label">{formatResourceLabel(cell?.resourceType)}</div>
                            <div className="slot-meta" />
                          </div>
                        );
                      })}
                    </div>
                    <div className="track bottom">
                      {TRACK_BOTTOM.map((domId) => {
                        const cell = trackByDomId.byId[domId];
                        const index = trackByDomId.byIndex[domId] ?? 0;
                        return (
                          <div
                            key={domId}
                            className="track-slot track-tile"
                            id={domId}
                            data-tile-index={index}
                          >
                            <div className="slot-label">{formatResourceLabel(cell?.resourceType)}</div>
                            <div className="slot-meta" />
                          </div>
                        );
                      })}
                    </div>
                    <div className="track left">
                      {TRACK_LEFT.map((domId) => {
                        const cell = trackByDomId.byId[domId];
                        const index = trackByDomId.byIndex[domId] ?? 0;
                        return (
                          <div
                            key={domId}
                            className="track-slot track-tile"
                            id={domId}
                            data-tile-index={index}
                          >
                            <div className="slot-label">{formatResourceLabel(cell?.resourceType)}</div>
                            <div className="slot-meta" />
                          </div>
                        );
                      })}
                    </div>

                    <div className="board-center">
                      {state?.board ? null : <p className="board-center-placeholder">Grand Bazaar</p>}
                    </div>
                    <div className="token-layer" ref={tokenLayerRef} aria-hidden="true">
                      {tokens.map((token) => (
                        <div
                          key={token.id}
                          className={`token ${token.shape === "square" ? "token-square" : "token-circle"}`}
                          style={{
                            background: token.color,
                            width: "18px",
                            height: "18px",
                            left: `${token.left}px`,
                            top: `${token.top}px`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </main>

              <aside className="hud-right test-class" aria-label="Dice and actions">
                <div className="dice-panel">
                  <div className="dice-container-inline">
                    {[0, 1].map((idx) => {
                      const roll = state?.lastRoll;
                      const value = idx === 0 ? roll?.d1 : roll?.d2;
                      return (
                        <div className="dice-card dice-slot" key={idx}>
                          <img
                            alt=""
                            className="dice-img"
                            src={value ? `${apiBase}/assets/dice/dice-${value}.png` : ""}
                            style={{ display: value ? "" : "none" }}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                          <span className="dice-text" style={{ display: value ? "none" : "" }}>
                            {value || "?"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className={`dice-result-inline ${state?.lastRoll ? "" : "hidden"}`}>
                    {state?.lastRoll
                      ? `Roll: ${state.lastRoll.d1} + ${state.lastRoll.d2} = ${state.lastRoll.total}${
                          state.lastRoll.isDouble ? " (Doubles!)" : ""
                        }`
                      : ""}
                  </div>
                  <div className="game-actions-inline">
                    <button type="button" className="btn btn-primary hidden" disabled>
                      Roll Dice
                    </button>
                    <button type="button" className="btn hidden" disabled>
                      End Turn
                    </button>
                    <button type="button" className="btn hidden" disabled>
                      Block Tile
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          </div>

          <div className="breach-panel hidden">
            <h3>Breach! Choose a tile to block:</h3>
            <div className="tile-selection" />
          </div>

          <div className="building-panel hidden">
            <h3>Place Building</h3>
            <div className="building-options">
              <button type="button" className="btn" disabled>
                Outpost (1 stone, 1 water) - 1 DP
              </button>
              <button type="button" className="btn" disabled>
                Bastion (1 iron, 1 food) - +1 Defense
              </button>
            </div>
            <div className="tile-selection building-tile-selection hidden" />
            <p className="building-hint">Select a building type, then choose a tile from the list.</p>
            <p className="building-hint" style={{ fontSize: "0.75rem", marginTop: "4px" }}>
              Upgrades: Outpost → Citadel (2 stone, 2 food) → Capital (3 stone, 3 iron, 2 gold)
            </p>
          </div>
        </section>

        <section className={`game-section ${showGame ? "" : "hidden"}`} id="logSection">
          <h3>Event log</h3>
          <div className="event-log" ref={logRef}>
            {(state?.eventLog || []).map((entry, index) => (
              <div key={`${entry?.msg || "log"}-${index}`}>{entry?.msg || ""}</div>
            ))}
          </div>
        </section>

        <div className={`error-msg ${errorMsg ? "" : "hidden"}`} role="alert">
          {errorMsg}
        </div>
      </div>
    </div>
  );
}
