/**
 * Turning a plan's location into something tappable.
 *
 * The location field accepts either a pasted map link or a plain place name,
 * because both are natural: people copy a Google Maps link out of the app, or
 * they just type "بادل إن، حي النخيل". A place name becomes a Maps *search*
 * URL, which resolves fine on mobile and opens the native app when installed.
 */

const MAP_HOSTS = [
  "google.com",
  "www.google.com",
  "maps.google.com",
  "goo.gl",
  "maps.app.goo.gl",
  "apple.com",
  "maps.apple.com",
  "waze.com",
  "www.waze.com",
];

/** True when the text is already a usable https map link. */
export function isMapLink(value: string): boolean {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return false;
    return MAP_HOSTS.includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * A URL for the location, or null when there is nothing to link.
 * Pasted map links pass through untouched; anything else becomes a Maps search.
 */
export function mapsUrl(location: string | null | undefined): string | null {
  const value = location?.trim();
  if (!value) return null;
  if (isMapLink(value)) return value;
  // Non-map https links are left alone rather than being searched for.
  if (/^https:\/\//i.test(value)) return value;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
}

/**
 * What to show for a location. A long pasted URL is unreadable in a card, so
 * link text falls back to a short label while the href keeps the full link.
 */
export function locationLabel(location: string | null | undefined): string | null {
  const value = location?.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return "الموقع على الخريطة";
  return value;
}
