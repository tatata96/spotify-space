import { GoogleGenAI, ApiError } from "@google/genai";
import type { GalleryItemAiFacets } from "@/types/types";

export class GeminiQuotaExceededError extends Error {
  constructor() {
    super("Gemini free tier quota exceeded");
    this.name = "GeminiQuotaExceededError";
  }
}

type TrackInput = {
  id: string;
  title: string;
  artist: string;
};

type GeminiEnrichedItem = {
  id: string;
  genre?: string;
  country?: string;
  bpm?: "slow" | "mid" | "fast" | "energetic";
};

const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

/**
 * Enriches a batch of tracks with genre, country, and BPM label via Gemini 2.0 Flash.
 * Returns a map from track id to AI facets. Missing or unparseable entries are silently skipped.
 */
export async function enrichTracksWithAi(
  tracks: TrackInput[],
): Promise<Record<string, GalleryItemAiFacets>> {
  if (!apiKey) return {};

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are a music metadata expert. For each track below, return a JSON array — one object per track.

Each object must have exactly these fields:
- "id": copy from input unchanged
- "genre": single genre string, e.g. "Pop", "Hip-Hop", "Electronic", "Rock", "R&B", "Jazz", "Classical", "Country", "Reggae", "Latin", "Metal", "Soul", "Blues", "Funk"
- "country": two-letter ISO 3166-1 alpha-2 code of the primary artist's origin country, e.g. "US", "GB", "NG", "KR", "BR", "SE"
- "bpm": one of:
  "slow"      — under 80 BPM (ballads, ambient, slow R&B)
  "mid"       — 80–110 BPM (moderate pop, classic R&B, soul)
  "fast"      — 110–135 BPM (uptempo pop, rock, standard hip-hop)
  "energetic" — 135+ BPM (EDM, drum and bass, fast hip-hop)

Always return a value for every field. Make your best guess if uncertain.
Return ONLY the JSON array — no explanation, no markdown.

Tracks:
${JSON.stringify(tracks)}`;

  let text: string;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    text = response.text ?? "[]";
  } catch (err) {
    if (err instanceof ApiError && err.status === 429) {
      throw new GeminiQuotaExceededError();
    }
    throw err;
  }

  let parsed: GeminiEnrichedItem[];
  try {
    parsed = JSON.parse(text) as GeminiEnrichedItem[];
  } catch {
    return {};
  }

  if (!Array.isArray(parsed)) return {};

  return Object.fromEntries(
    parsed
      .filter((item): item is GeminiEnrichedItem & { id: string } =>
        typeof item === "object" && item !== null && typeof item.id === "string",
      )
      .map((item) => [
        item.id,
        {
          genre: item.genre,
          country: item.country,
          bpm: item.bpm,
        } satisfies GalleryItemAiFacets,
      ]),
  );
}
