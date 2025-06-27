import { RequestHandler } from "express";
import { MusicSearchResponse, MusicTrack } from "@shared/api";

// iTunes API response interface
interface iTunesResult {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  releaseDate?: string;
  primaryGenreName?: string;
  trackPrice?: number;
  currency?: string;
  trackViewUrl?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  trackTimeMillis?: number;
  kind?: string;
}

interface iTunesSearchResponse {
  resultCount: number;
  results: iTunesResult[];
}

// Genre mapping for better categorization
const genreMapping: Record<string, string[]> = {
  Pop: ["Pop", "Dance"],
  Rock: ["Rock", "Alternative"],
  "Hip-Hop/Rap": ["Hip-Hop", "Rap"],
  "R&B/Soul": ["R&B", "Soul"],
  Electronic: ["Electronic", "EDM"],
  Country: ["Country"],
  Jazz: ["Jazz"],
  Classical: ["Classical"],
  Alternative: ["Alternative", "Indie"],
  Reggae: ["Reggae"],
  Blues: ["Blues"],
  Folk: ["Folk"],
  World: ["World"],
  Soundtrack: ["Soundtrack"],
  "Singer/Songwriter": ["Singer/Songwriter", "Acoustic"],
};

// Calculate popularity based on various factors
function calculatePopularity(track: iTunesResult): number {
  let popularity = 50; // Base popularity

  // Factor in price (lower price often means more popular/older)
  if (track.trackPrice !== undefined) {
    if (track.trackPrice === 0)
      popularity += 10; // Free tracks
    else if (track.trackPrice < 1)
      popularity += 15; // Cheap tracks
    else if (track.trackPrice > 1.5) popularity -= 5; // Expensive tracks
  }

  // Factor in genre popularity
  const genre = track.primaryGenreName || "";
  if (["Pop", "Hip-Hop/Rap", "Alternative"].includes(genre)) {
    popularity += 20;
  } else if (["Rock", "R&B/Soul", "Electronic"].includes(genre)) {
    popularity += 15;
  } else if (["Country", "Folk"].includes(genre)) {
    popularity += 10;
  }

  // Factor in release date (newer songs get a boost)
  if (track.releaseDate) {
    const releaseYear = new Date(track.releaseDate).getFullYear();
    const currentYear = new Date().getFullYear();
    const age = currentYear - releaseYear;

    if (age <= 1)
      popularity += 25; // Very recent
    else if (age <= 3)
      popularity += 15; // Recent
    else if (age <= 5)
      popularity += 5; // Somewhat recent
    else if (age > 20) popularity += 10; // Classic bonus
  }

  // Random factor for variety
  popularity += Math.random() * 10 - 5;

  return Math.max(1, Math.min(100, Math.round(popularity)));
}

// Convert iTunes result to our MusicTrack format
function convertToMusicTrack(result: iTunesResult): MusicTrack {
  const releaseYear = result.releaseDate
    ? new Date(result.releaseDate).getFullYear()
    : undefined;

  const genre = result.primaryGenreName;
  const mappedGenres = genre ? genreMapping[genre] || [genre] : undefined;

  return {
    id: String(result.trackId || Date.now() + Math.random()),
    title: result.trackName || "Unknown Title",
    artist: result.artistName || "Unknown Artist",
    album: result.collectionName,
    releaseYear,
    genre: mappedGenres,
    popularity: calculatePopularity(result),
  };
}

export const handleMusicSearch: RequestHandler = async (req, res) => {
  try {
    const query = req.query.q as string;

    if (!query || query.length < 2) {
      const response: MusicSearchResponse = {
        tracks: [],
        total: 0,
      };
      return res.json(response);
    }

    // Search iTunes API
    const encodedQuery = encodeURIComponent(query);
    const iTunesUrl = `https://itunes.apple.com/search?term=${encodedQuery}&media=music&entity=song&limit=25`;

    const iTunesResponse = await fetch(iTunesUrl);

    if (!iTunesResponse.ok) {
      throw new Error(`iTunes API error: ${iTunesResponse.status}`);
    }

    const iTunesData: iTunesSearchResponse = await iTunesResponse.json();

    // Filter for music tracks only and convert to our format
    const musicTracks = iTunesData.results
      .filter(
        (result) =>
          result.kind === "song" && result.trackName && result.artistName,
      )
      .map(convertToMusicTrack);

    // Remove duplicates based on title + artist
    const uniqueTracks = musicTracks.filter((track, index, array) => {
      return (
        index ===
        array.findIndex(
          (t) =>
            t.title.toLowerCase() === track.title.toLowerCase() &&
            t.artist.toLowerCase() === track.artist.toLowerCase(),
        )
      );
    });

    // Sort by relevance and popularity
    const searchTerms = query.toLowerCase().split(" ");
    const sortedTracks = uniqueTracks.sort((a, b) => {
      // Check for exact title matches first
      const aExactTitle = a.title.toLowerCase().includes(query.toLowerCase());
      const bExactTitle = b.title.toLowerCase().includes(query.toLowerCase());

      if (aExactTitle && !bExactTitle) return -1;
      if (!aExactTitle && bExactTitle) return 1;

      // Check for exact artist matches
      const aExactArtist = a.artist.toLowerCase().includes(query.toLowerCase());
      const bExactArtist = b.artist.toLowerCase().includes(query.toLowerCase());

      if (aExactArtist && !bExactArtist) return -1;
      if (!aExactArtist && bExactArtist) return 1;

      // Calculate relevance score
      const getRelevanceScore = (track: MusicTrack) => {
        const titleMatch = searchTerms.filter((term) =>
          track.title.toLowerCase().includes(term),
        ).length;
        const artistMatch = searchTerms.filter((term) =>
          track.artist.toLowerCase().includes(term),
        ).length;
        return titleMatch * 2 + artistMatch;
      };

      const aRelevance = getRelevanceScore(a);
      const bRelevance = getRelevanceScore(b);

      if (aRelevance !== bRelevance) return bRelevance - aRelevance;

      // Finally sort by popularity
      return b.popularity - a.popularity;
    });

    const response: MusicSearchResponse = {
      tracks: sortedTracks.slice(0, 10), // Limit to top 10 results
      total: sortedTracks.length,
    };

    console.log(`Found ${response.total} tracks for query: "${query}"`);
    res.json(response);
  } catch (error) {
    console.error("Music search error:", error);

    // Fallback response in case of API failure
    const response: MusicSearchResponse = {
      tracks: [],
      total: 0,
    };

    res.json(response);
  }
};
