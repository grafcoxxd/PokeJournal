import { Cog } from "lucide-react";
import type { Album } from "@/lib/types";

export function AlbumCover({
  album,
  onOpen,
  onEdit
}: {
  album: Album;
  onOpen: () => void;
  onEdit: () => void;
}) {
  return (
    <article className="album-card">
      <button
        className="album-book"
        style={{ "--cover": album.coverColor } as React.CSSProperties}
        onClick={onOpen}
        aria-label={`${album.title} öffnen`}
      >
        <span className="album-stitch" />
        <span className="album-title">{album.title}</span>
        {album.spriteId ? (
          <img
            className="album-sprite"
            src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${album.spriteId}.png`}
            alt=""
          />
        ) : (
          <span className="album-monogram">{album.title.slice(0, 1).toUpperCase()}</span>
        )}
        <span className="album-clasp" />
      </button>
      <button className="edit-album-button" onClick={onEdit}>
        <Cog size={18} />
        Album bearbeiten
      </button>
    </article>
  );
}
