import { useState, useEffect } from "react";
import { Search, Music, TrendingUp } from "lucide-react";
import { Input } from "./input";
import { Button } from "./button";
import { Badge } from "./badge";
import { cn } from "@/lib/utils";
import { MusicTrack, MusicSearchResponse } from "@shared/api";

interface MusicSearchProps {
  onTrackSelect: (track: MusicTrack) => void;
  className?: string;
}

export function MusicSearch({ onTrackSelect, className }: MusicSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MusicTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const searchTracks = async () => {
      if (query.length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/music/search?q=${encodeURIComponent(query)}`,
        );
        const data = (await response.json()) as MusicSearchResponse;
        setResults(data.tracks);
        setIsOpen(true);
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchTracks, 300);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  const handleTrackSelect = (track: MusicTrack) => {
    setQuery(`${track.artist} - ${track.title}`);
    setIsOpen(false);
    onTrackSelect(track);
  };

  return (
    <div className={cn("relative w-full max-w-2xl", className)}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
        <Input
          type="text"
          placeholder="Search for songs, artists, or albums..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-12 pr-4 py-6 text-lg border-2 border-primary/20 focus:border-primary shadow-lg"
        />
        {isSearching && (
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border-2 border-border rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          {results.map((track) => (
            <button
              key={track.id}
              onClick={() => handleTrackSelect(track)}
              className="w-full p-4 hover:bg-muted transition-colors text-left border-b border-border last:border-b-0 group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="bg-primary/10 p-2 rounded-lg group-hover:bg-primary/20 transition-colors">
                    <Music className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">
                      {track.title}
                    </h3>
                    <p className="text-muted-foreground text-sm truncate">
                      {track.artist}
                    </p>
                    {track.album && (
                      <p className="text-muted-foreground text-xs truncate">
                        {track.album}{" "}
                        {track.releaseYear && `(${track.releaseYear})`}
                      </p>
                    )}
                    {track.genre && track.genre.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {track.genre.slice(0, 3).map((genre) => (
                          <Badge
                            key={genre}
                            variant="secondary"
                            className="text-xs"
                          >
                            {genre}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary">
                      {Math.round(track.popularity)}%
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && results.length === 0 && !isSearching && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border-2 border-border rounded-lg shadow-xl z-50 p-4 text-center text-muted-foreground">
          No tracks found for "{query}"
        </div>
      )}
    </div>
  );
}
