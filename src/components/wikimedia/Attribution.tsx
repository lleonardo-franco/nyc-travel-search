import type { NearbyPhoto } from "@/lib/types";

/** Crédito exigido pelas licenças livres (autor, licença e link para o arquivo). */
export function Attribution({ photo, className = "" }: { photo: NearbyPhoto; className?: string }) {
  return (
    <a href={photo.pageUrl} target="_blank" rel="noreferrer" className={`block truncate hover:underline ${className}`} title={photo.title}>
      Foto: {photo.author ?? "autor desconhecido"}
      {photo.license ? ` · ${photo.license}` : ""} · Wikimedia Commons
    </a>
  );
}
