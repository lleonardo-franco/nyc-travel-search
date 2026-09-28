"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { nightlyPrice } from "@/lib/filters/hotels";
import { formatMoney } from "@/lib/format";
import { distanceKm } from "@/lib/geo";
import type { Currency, Hotel } from "@/lib/types";

// Tiles do OpenStreetMap (uso leve, com atribuição). Para produção com tráfego alto,
// use um provedor próprio via NEXT_PUBLIC_MAP_TILES (MapTiler, Stadia, CARTO com chave…).
const TILES = process.env.NEXT_PUBLIC_MAP_TILES || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function pinHtml(label: string, active: boolean, muted: boolean) {
  return `<div class="price-pin${active ? " is-active" : ""}${muted ? " is-muted" : ""}">${escapeHtml(label)}</div>`;
}

/**
 * Mapa com um pino de preço por hotel. Clique no pino destaca o card; passar o mouse
 * no card destaca o pino. Pontos sem coordenadas ficam de fora.
 */
export default function HotelsMap({
  hotels,
  currency,
  activeId,
  onSelect,
  vendors,
  className = "",
  single,
}: {
  hotels: Hotel[];
  currency: Currency;
  activeId?: string | null;
  onSelect?: (id: string) => void;
  vendors?: string[];
  className?: string;
  /** Mapa de um hotel só (página de detalhes): pino simples e zoom de rua. */
  single?: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, { marker: L.Marker; label: string; muted: boolean }>());
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: true, scrollWheelZoom: !single }).setView([40.754, -73.984], 13);
    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(m);
    map.current = m;
    const current = markers.current;
    return () => {
      m.remove();
      map.current = null;
      current.clear();
    };
  }, [single]);

  // Recria os pinos quando a lista muda.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    for (const { marker } of markers.current.values()) marker.remove();
    markers.current.clear();

    const points: { lat: number; lng: number }[] = [];
    for (const h of hotels) {
      if (!h.location) continue;
      const price = nightlyPrice(h, vendors);
      const hasOffer = h.offers.length > 0;
      const label = single ? h.name : price != null ? formatMoney(price, currency) : "…";
      const muted = !single && !hasOffer;
      const marker = L.marker([h.location.lat, h.location.lng], {
        icon: L.divIcon({ className: "pin-wrapper", html: pinHtml(label, false, muted), iconSize: [0, 0] }),
        title: h.name,
        riseOnHover: true,
      }).addTo(m);
      marker.on("click", () => onSelectRef.current?.(h.id));
      markers.current.set(h.id, { marker, label, muted });
      points.push(h.location);
    }
    if (single && points.length) m.setView([points[0].lat, points[0].lng], 16);
    else if (points.length > 1) {
      // Enquadra o "miolo" dos resultados: hotéis isolados (ex.: perto do JFK) não afastam o zoom.
      const mid = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
      const center = { lat: mid(points.map((p) => p.lat)), lng: mid(points.map((p) => p.lng)) };
      const core = points.filter((p) => distanceKm(p, center) < 4);
      const frame = core.length >= 2 ? core : points;
      m.fitBounds(L.latLngBounds(frame.map((p) => [p.lat, p.lng] as L.LatLngTuple)), { padding: [40, 40], maxZoom: 15 });
    }
  }, [hotels, currency, vendors, single]);

  // Destaque do pino ativo.
  useEffect(() => {
    for (const [id, { marker, label, muted }] of markers.current) {
      const active = id === activeId;
      marker.setIcon(L.divIcon({ className: "pin-wrapper", html: pinHtml(label, active, muted), iconSize: [0, 0] }));
      marker.setZIndexOffset(active ? 1000 : 0);
    }
  }, [activeId, hotels]);

  return <div ref={el} className={`z-0 h-full w-full ${className}`} role="region" aria-label="Mapa dos hotéis" />;
}
