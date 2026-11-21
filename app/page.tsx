"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Download,
  Plus,
  Search,
  Settings,
  Trash2
} from "lucide-react";
import { AlbumCover } from "@/components/AlbumCover";
import { AlbumEditor } from "@/components/AlbumEditor";
import { CardDetail } from "@/components/CardDetail";
import { useJournal } from "@/hooks/useJournal";
import type { Album, Card, CardCandidate, Tab } from "@/lib/types";
import { createAlbum, EMPTY_JOURNAL } from "@/lib/types";
import { APP_VERSION } from "@/lib/version";

interface SlotLocation {
  albumId: string;
  pageId: string;
  slot: number;
}

interface OpenCard {
  card: CardCandidate;
  location?: SlotLocation;
}

const languageLabels: Record<string, string> = {
  de: "Deutsch",
  en: "English",
  fr: "Français",
  it: "Italiano",
  es: "Español",
  pt: "Português",
  "es-419": "Español (LATAM)",
  nl: "Nederlands",
  pl: "Polski",
  ja: "日本語",
  ko: "한국어",
  "zh-cn": "简体中文",
  "zh-tw": "繁體中文",
  th: "ไทย",
  id: "Indonesia"
};

export default function Home() {
  const { journal, connection, ready, updateJournal, addPage } = useJournal();
  const [tab, setTab] = useState<Tab>("albums");
  const [openAlbumId, setOpenAlbumId] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [editorId, setEditorId] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<OpenCard | null>(null);
  const [pendingPlacement, setPendingPlacement] = useState<SlotLocation | null>(null);
  const [query, setQuery] = useState("");
  const [setCode, setSetCode] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [results, setResults] = useState<CardCandidate[]>([]);
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotalPages, setSearchTotalPages] = useState(1);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [activeLanguages, setActiveLanguages] = useState([
    "de", "en", "fr", "it", "es", "es-419", "pt", "nl", "pl", "ja", "ko", "zh-cn", "zh-tw", "th", "id"
  ]);
  const openAlbum = journal.albums.find((album) => album.id === openAlbumId);
  const editingAlbum = journal.albums.find((album) => album.id === editorId);

  const visiblePage = openAlbum?.pages[Math.min(pageIndex, openAlbum.pages.length - 1)];
  const allCards = journal.albums.reduce(
    (sum, album) => sum + album.pages.reduce((pageSum, page) => pageSum + page.slots.filter(Boolean).length, 0),
    0
  );
  const totalWish = journal.albums.flatMap((album) => album.pages).flatMap((page) => page.slots).reduce(
    (sum, card) => sum + (card?.wishValue ?? 0),
    0
  );

  function updateAlbum(album: Album) {
    updateJournal((current) => ({
      ...current,
      albums: current.albums.map((item) => item.id === album.id ? album : item)
    }));
  }

  function createNewAlbum() {
    const album = createAlbum();
    updateJournal((current) => ({ ...current, albums: [...current.albums, album] }));
    setEditorId(album.id);
  }

  function deleteAlbum(id: string) {
    if (!confirm("Dieses Album und alle darin enthaltenen Karten wirklich löschen?")) return;
    updateJournal((current) => ({
      ...current,
      albums: current.albums.filter((album) => album.id !== id)
    }));
    setEditorId(null);
    if (openAlbumId === id) setOpenAlbumId(null);
  }

  function setSlot(location: SlotLocation, card: Card | null) {
    updateJournal((current) => ({
      ...current,
      albums: current.albums.map((album) =>
        album.id !== location.albumId
          ? album
          : {
              ...album,
              pages: album.pages.map((page) =>
                page.id !== location.pageId
                  ? page
                  : {
                      ...page,
                      slots: page.slots.map((slot, index) => index === location.slot ? card : slot)
                    }
              )
            }
      )
    }));
  }

  function addCandidate(card: CardCandidate, location = pendingPlacement) {
    const stored: Card = {
      ...card,
      wishValue: "wishValue" in card && typeof card.wishValue === "number" ? card.wishValue : 0,
      canonicalCardId: card.canonicalCardId ?? card.id
    };
    if (location) {
      setSlot(location, stored);
      setOpenAlbumId(location.albumId);
      setPageIndex(
        journal.albums.find((album) => album.id === location.albumId)?.pages.findIndex(
          (page) => page.id === location.pageId
        ) ?? 0
      );
      setTab("albums");
      setPendingPlacement(null);
    }
  }

  function moveCard(from: SlotLocation, to: SlotLocation) {
    const sourceAlbum = journal.albums.find((album) => album.id === from.albumId);
    const sourceCard = sourceAlbum?.pages.find((page) => page.id === from.pageId)?.slots[from.slot];
    if (!sourceCard) return;
    updateJournal((current) => {
      const cloned: Album[] = structuredClone(current.albums);
      const fromPage = cloned.find((album) => album.id === from.albumId)?.pages.find((page) => page.id === from.pageId);
      const toPage = cloned.find((album) => album.id === to.albumId)?.pages.find((page) => page.id === to.pageId);
      if (!fromPage || !toPage) return current;
      const targetCard = toPage.slots[to.slot];
      fromPage.slots[from.slot] = targetCard;
      toPage.slots[to.slot] = sourceCard;
      return { ...current, albums: cloned };
    });
  }

  function removePage() {
    if (!openAlbum || !visiblePage || openAlbum.pages.length <= 1) return;
    if (!confirm(`Seite ${pageIndex + 1} mit allen Karten löschen?`)) return;
    updateAlbum({
      ...openAlbum,
      pages: openAlbum.pages.filter((page) => page.id !== visiblePage.id)
    });
    setPageIndex((current) => Math.max(0, current - 1));
  }

  async function runSearch(event?: FormEvent, requestedPage = 1) {
    event?.preventDefault();
    if (!query.trim() && !setCode.trim() && !cardNumber.trim()) {
      setSearchError("Gib mindestens einen Namen, Set-Code oder eine Kartennummer ein.");
      return;
    }
    setSearching(true);
    setSearchError("");
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (setCode.trim()) params.set("set", setCode.trim());
    if (cardNumber.trim()) params.set("number", cardNumber.trim());
    params.set("languages", activeLanguages.join(","));
    params.set("page", String(requestedPage));
    try {
      const response = await fetch(`/api/cards?${params}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      setResults(payload.cards);
      setSearchPage(payload.page ?? 1);
      setSearchTotalPages(payload.totalPages ?? 1);
      setSearchTotal(payload.total ?? payload.cards.length);
      if (payload.total === 0) setSearchError("Keine passenden Karten gefunden.");
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Suche fehlgeschlagen.");
    } finally {
      setSearching(false);
    }
  }

  const placementLabel = useMemo(() => {
    if (!pendingPlacement) return "";
    const album = journal.albums.find((item) => item.id === pendingPlacement.albumId);
    const page = album?.pages.findIndex((item) => item.id === pendingPlacement.pageId) ?? -1;
    return album ? `${album.title} · Seite ${page + 1} · Fach ${pendingPlacement.slot + 1}` : "";
  }, [journal.albums, pendingPlacement]);

  function navigate(target: Tab) {
    setTab(target);
    if (target !== "albums") {
      setOpenAlbumId(null);
      setPendingPlacement(null);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="brand" onClick={() => { setTab("albums"); setOpenAlbumId(null); }}>
          Poké<span>Journal</span>
        </button>
        <div className={`connection-pill ${connection.connected ? "online" : "offline"}`}>
          <span className="connection-dot" />
          <span>{connection.connected ? "Verbunden" : "Demo"}<small>{connection.message.replace("Verbunden", "IP-basiert")}</small></span>
        </div>
      </header>

      <main className="app-main">
        {!ready ? (
          <div className="loading-screen">
            <span className="pokeball-spinner" />
            <p>Journal wird geöffnet …</p>
          </div>
        ) : tab === "albums" && openAlbum && visiblePage ? (
          <section className="album-view">
            <div className="page-toolbar">
              <button className="icon-button" onClick={() => setOpenAlbumId(null)} aria-label="Zurück zu den Alben">
                <ArrowLeft />
              </button>
              <div>
                <span className="eyebrow">Offenes Album</span>
                <h1>{openAlbum.title}</h1>
              </div>
              <button className="icon-button" onClick={() => setEditorId(openAlbum.id)} aria-label="Album bearbeiten">
                <Settings />
              </button>
            </div>
            <div className="page-book" style={{ "--inner": openAlbum.innerColor } as React.CSSProperties}>
              <div className="card-grid">
                {visiblePage.slots.map((card, slot) => (
                  <div
                    className={`card-slot ${card ? "occupied" : ""}`}
                    key={`${visiblePage.id}-${slot}`}
                    draggable={Boolean(card)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", `${openAlbum.id}|${visiblePage.id}|${slot}`);
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const [albumId, pageId, fromSlot] = event.dataTransfer.getData("text/plain").split("|");
                      if (albumId && pageId) moveCard(
                        { albumId, pageId, slot: Number(fromSlot) },
                        { albumId: openAlbum.id, pageId: visiblePage.id, slot }
                      );
                    }}
                  >
                    {card ? (
                      <button
                        className="slot-card"
                        onClick={() => setOpenCard({
                          card,
                          location: { albumId: openAlbum.id, pageId: visiblePage.id, slot }
                        })}
                        aria-label={`${card.name} öffnen`}
                      >
                        <img src={card.image} alt={card.name} />
                        {card.imageFallback && <span className="image-fallback-badge">Ersatzbild</span>}
                        <span className="slot-value">{card.wishValue.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>
                      </button>
                    ) : (
                      <button
                        className="empty-slot"
                        onClick={() => {
                          setPendingPlacement({ albumId: openAlbum.id, pageId: visiblePage.id, slot });
                          setTab("search");
                          setOpenAlbumId(null);
                        }}
                        aria-label={`Karte in Fach ${slot + 1} hinzufügen`}
                      >
                        <Plus />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="page-navigation in-book">
                <button
                  className="round-button"
                  disabled={pageIndex === 0}
                  onClick={() => setPageIndex((value) => value - 1)}
                  aria-label="Vorherige Seite"
                >
                  <ChevronLeft />
                </button>
                <strong>Seite {pageIndex + 1} / {openAlbum.pages.length}</strong>
                <button
                  className="round-button"
                  disabled={pageIndex >= openAlbum.pages.length - 1}
                  onClick={() => setPageIndex((value) => value + 1)}
                  aria-label="Nächste Seite"
                >
                  <ChevronRight />
                </button>
              </div>
            </div>
            <div className="page-manage-actions">
              <button className="secondary-button" onClick={() => {
                addPage(openAlbum.id);
                setPageIndex(openAlbum.pages.length);
              }}>
                <Plus size={18} /> Seite hinzufügen
              </button>
              <button className="text-button danger" onClick={removePage} disabled={openAlbum.pages.length === 1}>
                <Trash2 size={16} /> Seite löschen
              </button>
            </div>
          </section>
        ) : tab === "albums" ? (
          <section>
            <div className="overview-heading">
              <div>
                <span className="eyebrow">Deine Sammlung</span>
                <h1>Meine Alben</h1>
              </div>
              <div className="mini-stats">
                <strong>{allCards}</strong>
                <span>Karten</span>
              </div>
            </div>
            {journal.albums.length ? (
              <div className="album-grid">
                {journal.albums.map((album) => (
                  <AlbumCover
                    album={album}
                    key={album.id}
                    onOpen={() => { setOpenAlbumId(album.id); setPageIndex(0); }}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <BookOpen size={42} />
                <h2>Dein erstes Album wartet</h2>
                <p>Erstelle ein Buch und sammle darin Karten, die du kaufen möchtest.</p>
                <button className="primary-button" onClick={createNewAlbum}>
                  <Plus size={18} /> Album anlegen
                </button>
              </div>
            )}
            <button className="floating-add" onClick={createNewAlbum} aria-label="Neues Album erstellen">
              <Plus />
            </button>
          </section>
        ) : tab === "search" ? (
          <section className="search-view">
            <div className="section-intro">
              <span className="eyebrow">International finden</span>
              <h1>Kartensuche</h1>
              <p>Suche nach Pokémon, Boosterpack-Code oder Kartennummer.</p>
            </div>
            {pendingPlacement && (
              <div className="placement-notice">
                <span>Einfügen in: <strong>{placementLabel}</strong></span>
                <button onClick={() => setPendingPlacement(null)} aria-label="Ziel löschen">×</button>
              </div>
            )}
            <form className="search-form" onSubmit={(event) => runSearch(event, 1)}>
              <label className="field">
                <span>Name</span>
                <span className="search-field large">
                  <Search size={20} />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="z. B. Pikachu ex" />
                </span>
              </label>
              <div className="two-fields">
                <label className="field">
                  <span>Set-Code</span>
                  <input value={setCode} onChange={(event) => setSetCode(event.target.value)} placeholder="SV7 / sv3pt5" />
                </label>
                <label className="field">
                  <span>Kartennummer</span>
                  <input value={cardNumber} onChange={(event) => setCardNumber(event.target.value)} placeholder="142/142" />
                </label>
              </div>
              <div className="language-filters" aria-label="Sprachen">
                {Object.entries(languageLabels).map(([language, label]) => (
                  <button
                    type="button"
                    key={language}
                    className={activeLanguages.includes(language) ? "active" : ""}
                    onClick={() => setActiveLanguages((current) =>
                      current.includes(language)
                        ? current.filter((item) => item !== language)
                        : [...current, language]
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button className="primary-button full-button" disabled={searching || activeLanguages.length === 0}>
                {searching ? "Suche läuft …" : "Karten suchen"}
              </button>
            </form>
            {searchError && <p className="notice error">{searchError}</p>}
            <div className="search-results">
              {results.map((card) => (
                <article className="search-result" key={card.id}>
                  <button className="result-image" onClick={() => setOpenCard({ card })}>
                    {card.image ? <img src={card.image} alt={card.name} loading="lazy" /> : <span>Ohne Bild</span>}
                    {card.imageFallback && <span className="image-fallback-badge">Ersatzbild</span>}
                  </button>
                  <div className="result-copy">
                    <span className="eyebrow">{card.language.toUpperCase()} · {card.setCode}</span>
                    <button className="result-title" onClick={() => setOpenCard({ card })}>{card.name}</button>
                    <p>{card.setName || "Set unbekannt"} · Nr. {card.number}</p>
                    <small>{card.source}</small>
                  </div>
                  <button
                    className="round-button add-result"
                    disabled={!pendingPlacement && journal.albums.length === 0}
                    onClick={() => {
                      if (pendingPlacement) {
                        addCandidate(card);
                      } else {
                        setOpenCard({ card });
                      }
                    }}
                    aria-label={pendingPlacement ? "In ausgewähltes Fach einfügen" : "Kartendetails öffnen"}
                  >
                    <Plus />
                  </button>
                </article>
              ))}
            </div>
            {results.length > 0 && (
              <div className="search-pagination">
                <button
                  className="round-button"
                  disabled={searching || searchPage <= 1}
                  onClick={() => runSearch(undefined, searchPage - 1)}
                  aria-label="Vorherige Ergebnisseite"
                >
                  <ChevronLeft />
                </button>
                <div>
                  <strong>Seite {searchPage} / {searchTotalPages}</strong>
                  <span>{searchTotal} Treffer · 20 je Seite</span>
                </div>
                <button
                  className="round-button"
                  disabled={searching || searchPage >= searchTotalPages}
                  onClick={() => runSearch(undefined, searchPage + 1)}
                  aria-label="Nächste Ergebnisseite"
                >
                  <ChevronRight />
                </button>
              </div>
            )}
            {!results.length && !searching && !searchError && (
              <div className="search-hint">
                <CircleHelp size={36} />
                <p>Asiatische und europäische Treffer werden gemeinsam verglichen. Tipp: Set-Code plus Nummer liefert die präzisesten Treffer.</p>
              </div>
            )}
          </section>
        ) : (
          <section className="settings-view">
            <div className="section-intro">
              <span className="eyebrow">Journal & Daten</span>
              <h1>Einstellungen</h1>
            </div>
            <article className="settings-card status-card">
              <div className={`status-orb ${connection.connected ? "online" : ""}`} />
              <div>
                <h2>{connection.connected ? "IP-basierter Speicher" : "Lokaler Demo-Speicher"}</h2>
                <p>{connection.message}</p>
                <small>
                  {connection.connected
                    ? "Neon PostgreSQL speichert den Stand auch, wenn Render schläft. IP-Adressen selbst werden nicht in der Datenbank abgelegt."
                    : "Ohne DATABASE_URL bleibt die App ausdrücklich im Browser-Demo-Modus. Produktion benötigt Neon und wird nicht lokal als dauerhaft ausgegeben."}
                </small>
              </div>
            </article>
            <div className="stats-grid">
              <article><strong>{journal.albums.length}</strong><span>Alben</span></article>
              <article><strong>{allCards}</strong><span>Karten</span></article>
              <article><strong>{totalWish.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</strong><span>Wunschsumme</span></article>
            </div>
            <button
              className="settings-row"
              onClick={() => {
                const blob = new Blob([JSON.stringify(journal, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = "pokejournal-export.json";
                anchor.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download />
              <span><strong>Journal exportieren</strong><small>Sicherheitskopie als JSON</small></span>
              <ChevronRight />
            </button>
            <button
              className="settings-row"
              onClick={() => {
                if (confirm("Wirklich alle Alben aus diesem Journal löschen?")) {
                  updateJournal(() => EMPTY_JOURNAL);
                }
              }}
            >
              <Trash2 />
              <span><strong>Alle Alben löschen</strong><small>Journal vollständig zurücksetzen</small></span>
              <ChevronRight />
            </button>
            <div className="privacy-note">
              <strong>Hinweis zur IP-Zuordnung</strong>
              <p>Die IP bildet nur eine komfortable, passwortlose Gerätezuordnung. Bei geteilten IP-Adressen, VPNs oder Provider-Wechseln kann die Zuordnung gemeinsam oder instabil sein. Verwende daher regelmäßig den Export.</p>
            </div>
            <div className="app-version">
              PokéJournal <strong>Version {APP_VERSION}</strong>
            </div>
          </section>
        )}
      </main>

      <nav className="bottom-nav" aria-label="Hauptnavigation">
        <button className={tab === "albums" ? "active" : ""} onClick={() => navigate("albums")}>
          <BookOpen /><span>Meine Alben</span>
        </button>
        <button className={tab === "search" ? "active" : ""} onClick={() => navigate("search")}>
          <Search /><span>Suche</span>
        </button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => navigate("settings")}>
          <Settings /><span>Einstellungen</span>
        </button>
      </nav>

      {editingAlbum && (
        <AlbumEditor
          album={editingAlbum}
          onClose={() => setEditorId(null)}
          onSave={(album) => { updateAlbum(album); setEditorId(null); }}
          onDelete={() => deleteAlbum(editingAlbum.id)}
        />
      )}
      {openCard && (
        <CardDetail
          card={openCard.card}
          albums={journal.albums}
          location={openCard.location}
          onClose={() => setOpenCard(null)}
          onUpdate={(card) => openCard.location && setSlot(openCard.location, card)}
          onAdd={(location, selectedCard) => {
            addCandidate(selectedCard, pendingPlacement ?? location);
            setOpenCard(null);
          }}
          onRemove={() => {
            if (openCard.location) setSlot(openCard.location, null);
            setOpenCard(null);
          }}
          onMove={(target) => openCard.location && moveCard(openCard.location, target)}
        />
      )}
    </div>
  );
}
