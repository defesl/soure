"use client";

import { useEffect, useMemo, useState } from "react";
import { getActiveGame, getMe, postLogout } from "@/lib/api";

const RECONNECT_POSITIONS = [
  "index-tile--reconnect-1",
  "index-tile--reconnect-2",
  "index-tile--reconnect-3",
  "index-tile--reconnect-4",
];

export default function Home() {
  const [user, setUser] = useState(null);
  const [reconnectGameId, setReconnectGameId] = useState(null);
  const [reconnectClass, setReconnectClass] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsUser, setSettingsUser] = useState(null);
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
    let active = true;
    getActiveGame()
      .then((data) => {
        if (!active) return;
        if (data?.ok && data.gameId) {
          setReconnectGameId(data.gameId);
          const idx = Math.floor(Math.random() * RECONNECT_POSITIONS.length);
          setReconnectClass(RECONNECT_POSITIONS[idx]);
        } else {
          setReconnectGameId(null);
        }
      })
      .catch(() => {
        if (!active) return;
        setReconnectGameId(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleOpenSettings = () => {
    setSettingsOpen(true);
    getMe()
      .then((data) => setSettingsUser(data?.user || null))
      .catch(() => setSettingsUser(null));
  };

  const handleLogout = () => {
    postLogout()
      .catch(() => {})
      .finally(() => {
        setUser(null);
        setSettingsOpen(false);
      });
  };

  return (
    <div className="index-landing">
      <div className="index-hero">
        <h1 className="index-title">Soure</h1>
        <p className="index-subtitle">Roll dice. Lose friends. Gain empire.</p>
        <div className="index-pills">
          <button type="button" className="index-pill" onClick={() => alert("Coming soon")}>
            Soure Rules
          </button>
          <button type="button" className="index-pill" onClick={() => alert("Coming soon")}>
            People can&apos;t be bought.
          </button>
        </div>
      </div>

      <nav className="index-tiles" aria-label="Main navigation">
        <a href="/game" className="index-tile index-tile--game" aria-label="Enter game lobby">
          Game
        </a>
        <a
          href={`${apiBase}/friends`}
          className="index-tile index-tile--friends"
          aria-label="Friends"
        >
          Friends
        </a>
        <button
          type="button"
          className="index-tile index-tile--resources"
          aria-label="Resources"
          onClick={() => alert("Coming soon")}
        >
          Resources
        </button>
        <button
          type="button"
          className="index-tile index-tile--settings"
          aria-label="Open settings"
          onClick={handleOpenSettings}
        >
          Settings
        </button>
        <span
          className={`index-reconnect-inline ${reconnectClass} ${
            reconnectGameId ? "" : "hidden"
          }`}
        >
          <a
            href={reconnectGameId ? `/game?gameId=${reconnectGameId}` : "#"}
            className="index-tile index-tile--reconnect"
            aria-label="Reconnect to your game"
          >
            Reconnect
          </a>
          <span className="index-reconnect-hint">You left an active game</span>
        </span>
        <a
          href={`${apiBase}/register`}
          className={`index-tile index-tile--register ${user ? "hidden" : ""}`}
          aria-label="Register"
        >
          Register
        </a>
        <a
          href={`${apiBase}/login`}
          className={`index-tile index-tile--login ${user ? "hidden" : ""}`}
          aria-label="Log in"
        >
          Login
        </a>
      </nav>

      <div className={`index-logged-in ${user ? "" : "hidden"}`}>
        Logged in as: <span>{user?.username}</span>
      </div>

      <div className={`index-modal ${settingsOpen ? "" : "hidden"}`} aria-hidden={!settingsOpen}>
        <div className="index-modal-backdrop" onClick={() => setSettingsOpen(false)} />
        <div className="index-modal-panel">
          <h2 className="index-modal-title">Settings</h2>
          <section className="index-settings-account">
            <h3>Account</h3>
            <p className="index-settings-username">
              {settingsUser?.username || "Not logged in"}
            </p>
            <p className="index-settings-muted">Session active</p>
          </section>
          <div className="index-modal-actions">
            <button type="button" className="btn btn-danger" onClick={handleLogout}>
              Logout
            </button>
            <button type="button" className="btn" onClick={() => setSettingsOpen(false)}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
