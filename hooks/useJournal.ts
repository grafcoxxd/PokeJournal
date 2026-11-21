"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConnectionState, JournalData } from "@/lib/types";
import { createAlbum, createPage, EMPTY_JOURNAL } from "@/lib/types";

const DEMO_KEY = "pokejournal:demo";

function demoJournal(): JournalData {
  const blue = createAlbum("Wasser & Wunder");
  blue.spriteId = 258;
  blue.coverColor = "#b9d9ff";
  blue.innerColor = "#dceafe";
  const green = createAlbum("Lieblingskarten");
  green.spriteId = 387;
  green.coverColor = "#bce8c4";
  green.innerColor = "#dff1dd";
  const pink = createAlbum("Japan-Highlights");
  pink.spriteId = 133 + 155;
  pink.coverColor = "#f4baca";
  pink.innerColor = "#f6e0e6";
  return { version: 1, albums: [blue, green, pink] };
}

export function useJournal() {
  const [journal, setJournal] = useState<JournalData>(EMPTY_JOURNAL);
  const [connection, setConnection] = useState<ConnectionState>({
    connected: false,
    storage: "unavailable",
    message: "Verbindung wird geprüft"
  });
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const latestJournal = useRef(journal);
  latestJournal.current = journal;

  useEffect(() => {
    let active = true;
    fetch("/api/journal")
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).message);
        return response.json();
      })
      .then((payload) => {
        if (!active) return;
        setJournal(payload.data ?? EMPTY_JOURNAL);
        setConnection({
          connected: true,
          storage: "neon",
          message: "Gerätebasiert verbunden",
          updatedAt: payload.updatedAt
        });
      })
      .catch(() => {
        if (!active) return;
        try {
          const stored = localStorage.getItem(DEMO_KEY);
          setJournal(stored ? JSON.parse(stored) : demoJournal());
        } catch {
          setJournal(demoJournal());
        }
        setConnection({
          connected: false,
          storage: "unavailable",
          message: "Demo-Speicher – Neon nicht konfiguriert"
        });
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const saveNow = useCallback(async (data: JournalData) => {
    if (connection.storage === "neon" && connection.connected) {
      const response = await fetch("/api/journal", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const payload = await response.json();
        setConnection({
          connected: false,
          storage: "unavailable",
          message: payload.message ?? "Speichern fehlgeschlagen"
        });
        throw new Error(payload.message);
      }
      const payload = await response.json();
      setConnection((current) => ({
        ...current,
        connected: true,
        message: "Gerätebasiert verbunden",
        updatedAt: payload.updatedAt
      }));
      return;
    }
    localStorage.setItem(DEMO_KEY, JSON.stringify(data));
  }, [connection.connected, connection.storage]);

  const updateJournal = useCallback((updater: (journal: JournalData) => JournalData) => {
    setJournal((current) => updater(current));
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const snapshot = structuredClone(latestJournal.current);
      saveQueue.current = saveQueue.current
        .catch(() => undefined)
        .then(() => saveNow(snapshot))
        .catch(() => undefined);
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [journal, ready, saveNow]);

  const addAlbum = useCallback(() => {
    setJournal((current) => ({ ...current, albums: [...current.albums, createAlbum()] }));
  }, []);

  const addPage = useCallback((albumId: string) => {
    setJournal((current) => ({
      ...current,
      albums: current.albums.map((album) =>
        album.id === albumId ? { ...album, pages: [...album.pages, createPage()] } : album
      )
    }));
  }, []);

  return { journal, connection, ready, updateJournal, addAlbum, addPage };
}
