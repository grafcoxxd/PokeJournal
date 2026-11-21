"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search, Trash2, X } from "lucide-react";
import type { Album } from "@/lib/types";

interface Sprite {
  id: number;
  name: string;
  image: string;
}

export function AlbumEditor({
  album,
  onClose,
  onSave,
  onDelete
}: {
  album: Album;
  onClose: () => void;
  onSave: (album: Album) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(album);
  const [query, setQuery] = useState("");
  const [sprites, setSprites] = useState<Sprite[]>([]);
  const [loading, setLoading] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: query,
          page: String(page)
        });
        if (generation) params.set("generation", String(generation));
        const response = await fetch(`/api/sprites?${params}`, {
          signal: controller.signal
        });
        const payload = await response.json();
        setSprites(payload.sprites ?? []);
        setPage(payload.page ?? 1);
        setTotalPages(payload.totalPages ?? 1);
        setTotal(payload.total ?? 0);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, generation, page]);

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal editor-modal" role="dialog" aria-modal="true" aria-labelledby="album-editor-title">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Schließen">
          <X />
        </button>
        <h2 id="album-editor-title">Album bearbeiten</h2>
        <label className="field">
          <span>Titel</span>
          <input
            value={draft.title}
            maxLength={40}
            autoFocus
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
        </label>
        <div className="color-row">
          <fieldset>
            <legend>Außenfarbe</legend>
            <input
              className="color-picker"
              type="color"
              value={draft.coverColor}
              onChange={(event) => setDraft({ ...draft, coverColor: event.target.value })}
              aria-label="Außenfarbe"
            />
          </fieldset>
          <fieldset>
            <legend>Innenfarbe</legend>
            <input
              className="color-picker"
              type="color"
              value={draft.innerColor}
              onChange={(event) => setDraft({ ...draft, innerColor: event.target.value })}
              aria-label="Innenfarbe"
            />
          </fieldset>
        </div>
        <label className="field">
          <span>Pokémon-Motiv (statisch)</span>
          <span className="search-field">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Name oder Pokédex-Nr."
            />
          </span>
        </label>
        <div className="sprite-controls">
          <label className="field">
            <span>Generation</span>
            <select
              value={generation}
              onChange={(event) => {
                setGeneration(Number(event.target.value));
                setPage(1);
              }}
            >
              <option value={0}>Alle Generationen</option>
              {Array.from({ length: 9 }, (_, index) => (
                <option value={index + 1} key={index + 1}>
                  Generation {index + 1}
                </option>
              ))}
            </select>
          </label>
          <span className="sprite-count">{total.toLocaleString("de-DE")} Pokémon</span>
        </div>
        <div className="sprite-grid" aria-busy={loading}>
          <button
            className={`sprite-option no-sprite ${draft.spriteId === null ? "selected" : ""}`}
            onClick={() => setDraft({ ...draft, spriteId: null })}
          >
            Keins
          </button>
          {sprites.map((sprite) => (
            <button
              key={sprite.id}
              className={`sprite-option ${draft.spriteId === sprite.id ? "selected" : ""}`}
              onClick={() => setDraft({ ...draft, spriteId: sprite.id })}
              title={`#${sprite.id} ${sprite.name}`}
            >
              <img src={sprite.image} alt={sprite.name} loading="lazy" />
              <small>#{sprite.id}</small>
            </button>
          ))}
          {!loading && sprites.length === 0 && (
            <p className="empty-message">Kein Sprite gefunden.</p>
          )}
        </div>
        <div className="sprite-pagination">
          <button
            className="icon-button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            aria-label="Vorherige Pokémon-Seite"
          >
            <ChevronLeft />
          </button>
          <span>Seite {page} / {totalPages}</span>
          <button
            className="icon-button"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            aria-label="Nächste Pokémon-Seite"
          >
            <ChevronRight />
          </button>
        </div>
        <div className="modal-actions">
          <button
            className="primary-button"
            disabled={!draft.title.trim()}
            onClick={() => onSave({ ...draft, title: draft.title.trim() })}
          >
            Speichern
          </button>
          <button className="danger-button" onClick={onDelete}>
            <Trash2 size={17} />
            Album löschen
          </button>
        </div>
      </section>
    </div>
  );
}
