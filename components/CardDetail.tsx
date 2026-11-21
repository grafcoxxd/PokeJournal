"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import type { Album, Card, CardCandidate } from "@/lib/types";

interface Location {
  albumId: string;
  pageId: string;
  slot: number;
}

export function CardDetail({
  card,
  albums,
  location,
  onClose,
  onUpdate,
  onAdd,
  onRemove,
  onMove
}: {
  card: CardCandidate;
  albums: Album[];
  location?: Location;
  onClose: () => void;
  onUpdate: (card: Card) => void;
  onAdd: (location: Location, card: CardCandidate) => void;
  onRemove: () => void;
  onMove: (target: Location) => void;
}) {
  const [displayed, setDisplayed] = useState<CardCandidate>(card);
  const [wish, setWish] = useState("wishValue" in card ? String(card.wishValue || "") : "");
  const [notes, setNotes] = useState("notes" in card ? card.notes ?? "" : "");
  const [variants, setVariants] = useState<CardCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [addAlbum, setAddAlbum] = useState(albums[0]?.id ?? "");
  const [addPage, setAddPage] = useState(albums[0]?.pages[0]?.id ?? "");
  const [addSlot, setAddSlot] = useState("auto");
  const [placementCard, setPlacementCard] = useState<CardCandidate>(card);
  const [placing, setPlacing] = useState(!location);
  const placementPanel = useRef<HTMLDivElement>(null);
  const [moveTarget, setMoveTarget] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/cards/variants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(displayed),
      signal: controller.signal
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message);
        if (payload.reference && payload.reference.id === displayed.id) {
          const merged = { ...displayed, ...payload.reference } as CardCandidate;
          setDisplayed(merged);
          if (location && (
            merged.setCode !== displayed.setCode ||
            merged.setName !== displayed.setName
          )) {
            onUpdate(asStored(merged));
          }
        }
        setVariants(payload.variants);
        if (payload.message) setError(payload.message);
      })
      .catch((caught) => {
        if (caught.name !== "AbortError") setError(caught.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [displayed.id]);

  const currentAlbum = albums.find((album) => album.id === location?.albumId);
  const moveOptions = useMemo(
    () =>
      albums.flatMap((album) =>
        album.pages.flatMap((page, pageIndex) =>
          page.slots.flatMap((slot, slotIndex) => {
            const isSame = location &&
              album.id === location.albumId &&
              page.id === location.pageId &&
              slotIndex === location.slot;
            if (slot || isSame) return [];
            return [{
              value: `${album.id}|${page.id}|${slotIndex}`,
              label: `${album.title} · Seite ${pageIndex + 1} · Fach ${slotIndex + 1}`
            }];
          })
        )
      ),
    [albums, location]
  );

  function asStored(value = displayed): Card {
    const parsed = Number(wish.replace(",", "."));
    return {
      ...value,
      notes,
      wishValue: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
      canonicalCardId: value.canonicalCardId ?? card.canonicalCardId ?? card.id
    };
  }

  function commitVariant(variant: CardCandidate) {
    const canonicalCardId =
      variant.canonicalCardId ?? displayed.canonicalCardId ?? card.canonicalCardId ?? card.id;
    const linkedVariant = { ...variant, canonicalCardId };
    setDisplayed(linkedVariant);
    setNotes(linkedVariant.notes ?? notes);
    setPlacementCard(linkedVariant);
    if (location) onUpdate(asStored(linkedVariant));
  }

  const selectedAlbum = albums.find((album) => album.id === addAlbum);
  const selectedPage = selectedAlbum?.pages.find((page) => page.id === addPage) ?? selectedAlbum?.pages[0];
  const freeSlots = selectedPage?.slots
    .map((slot, index) => ({ slot, index }))
    .filter((item) => item.slot === null) ?? [];

  function addExactCard(candidate: CardCandidate) {
    if (!selectedAlbum || !selectedPage || !freeSlots.length) return;
    const slot = addSlot === "auto" ? freeSlots[0].index : Number(addSlot);
    if (Number.isNaN(slot) || selectedPage.slots[slot]) return;
    onAdd({ albumId: selectedAlbum.id, pageId: selectedPage.id, slot }, candidate);
  }

  return (
    <div className="modal-backdrop">
      <section className="modal card-detail" role="dialog" aria-modal="true" aria-label={`${displayed.name} Details`}>
        <button className="icon-button modal-close" onClick={onClose} aria-label="Schließen">
          <X />
        </button>
        <div className="detail-image-wrap">
          {displayed.image ? (
            <img className="detail-image" src={displayed.image} alt={displayed.name} />
          ) : (
            <div className="missing-card">Kein Kartenbild</div>
          )}
          {displayed.imageFallback && (
            <span className="image-fallback-badge detail-badge">
              Ersatzbild{displayed.imageFallbackLanguage ? ` (${displayed.imageFallbackLanguage.toUpperCase()})` : ""}
            </span>
          )}
        </div>
        <div className="card-detail-copy">
          <span className="eyebrow">{displayed.setCode.toUpperCase()} · {displayed.number}</span>
          <h2>{displayed.name}</h2>
          <p className="muted">{displayed.setName} · {displayed.language.toUpperCase()}</p>
          {location && (
            <>
              <label className="field wish-field">
                <span>Wunsch-Wert in Euro</span>
                <span className="currency-input">
                  <input
                    inputMode="decimal"
                    value={wish}
                    placeholder="0,00"
                    onChange={(event) => setWish(event.target.value)}
                    onBlur={() => onUpdate(asStored())}
                    aria-label="Wunsch-Wert in Euro"
                  />
                  <strong>€</strong>
                </span>
              </label>
              <label className="field notes-field">
                <span>Notizen</span>
                <textarea
                  value={notes}
                  maxLength={4000}
                  rows={4}
                  placeholder="Zustand, Händler, Besonderheiten …"
                  onChange={(event) => setNotes(event.target.value)}
                  onBlur={() => onUpdate(asStored())}
                />
              </label>
              <div className="journal-actions">
                <label className="field compact-field">
                  <span>Karte verschieben</span>
                  <select value={moveTarget} onChange={(event) => setMoveTarget(event.target.value)}>
                    <option value="">Freies Fach wählen</option>
                    {moveOptions.map((option) => (
                      <option value={option.value} key={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <button
                  className="secondary-button"
                  disabled={!moveTarget}
                  onClick={() => {
                    const [albumId, pageId, slot] = moveTarget.split("|");
                    onMove({ albumId, pageId, slot: Number(slot) });
                    onClose();
                  }}
                >
                  Verschieben <ArrowRight size={17} />
                </button>
              </div>
              <button className="danger-button full-button" onClick={onRemove}>
                <Trash2 size={17} /> Aus dem Fach entfernen
              </button>
            </>
          )}
          {placing && albums.length > 0 && (
            <div className="add-card-panel" ref={placementPanel}>
              <div className="placement-card-label">
                <span>Hinzufügen</span>
                <strong>{placementCard.name}</strong>
                <small>{placementCard.language.toUpperCase()} · {placementCard.setCode}</small>
              </div>
              <label className="field">
                <span>Zum Album hinzufügen</span>
                <select value={addAlbum} onChange={(event) => {
                  const album = albums.find((item) => item.id === event.target.value);
                  setAddAlbum(event.target.value);
                  setAddPage(album?.pages[0]?.id ?? "");
                  setAddSlot("auto");
                }}>
                  {albums.map((album) => <option key={album.id} value={album.id}>{album.title}</option>)}
                </select>
              </label>
              <div className="two-fields">
                <label className="field">
                  <span>Seite</span>
                  <select value={selectedPage?.id ?? ""} onChange={(event) => {
                    setAddPage(event.target.value);
                    setAddSlot("auto");
                  }}>
                    {selectedAlbum?.pages.map((page, index) => (
                      <option key={page.id} value={page.id}>Seite {index + 1}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Fach</span>
                  <select value={addSlot} onChange={(event) => setAddSlot(event.target.value)}>
                    <option value="auto">Erstes freies Fach</option>
                    {freeSlots.map(({ index }) => (
                      <option key={index} value={index}>Fach {index + 1}</option>
                    ))}
                  </select>
                </label>
              </div>
              {freeSlots.length === 0 && (
                <p className="notice error">Diese Seite ist voll. Wähle eine andere Seite oder Album.</p>
              )}
              <button
                className="primary-button full-button"
                disabled={freeSlots.length === 0}
                onClick={() => addExactCard(placementCard)}
              >
                <Check size={18} /> Karte hinzufügen
              </button>
            </div>
          )}
        </div>
        <section className="variants">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Cross-Region</span>
              <h3>Andere Sprach-Pendants</h3>
            </div>
            {loading && <LoaderCircle className="spin" size={20} />}
          </div>
          {error && <p className="notice error">{error}</p>}
          {!loading && variants.length === 0 && !error && (
            <p className="muted">Noch kein sicher genuges Pendant gefunden.</p>
          )}
          <div className="variant-list">
            {variants.map((variant) => (
              <article className="variant-card" key={variant.id}>
                <button className="variant-main" onClick={() => commitVariant(variant)}>
                <img src={variant.image} alt="" loading="lazy" />
                {variant.imageFallback && <span className="image-fallback-badge">Ersatzbild</span>}
                <span>{variant.language.toUpperCase()} · {variant.setCode}</span>
                <small>{Math.round((variant.score ?? 0) * 100)} % · {(variant.matchReason ?? []).join(", ")}</small>
                </button>
                <button
                  className="variant-add"
                  onClick={() => {
                    setPlacementCard(variant);
                    setPlacing(true);
                    requestAnimationFrame(() => placementPanel.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
                  }}
                  aria-label={`${variant.name} zu einem Album hinzufügen`}
                  title="Zu Album hinzufügen"
                >
                  <Plus size={14} />
                </button>
              </article>
            ))}
          </div>
          {currentAlbum && (
            <p className="fine-print">Die gewählte Sprachversion wird in „{currentAlbum.title}“ angezeigt.</p>
          )}
        </section>
      </section>
    </div>
  );
}
