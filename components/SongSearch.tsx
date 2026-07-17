"use client";
import { useState, useCallback, useRef } from "react";

interface Result {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
}

interface Props {
  onSelect: (youtubeUrl: string, title: string) => void;
}

export default function SongSearch({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data.error) { setError(data.error); setResults([]); }
        else setResults(data.items ?? []);
      } catch {
        setError("Search failed");
      } finally {
        setLoading(false);
      }
    }, 400);
  }, []);

  const handleSelect = (r: Result) => {
    setSelected(r);
    setResults([]);
    setQuery(r.title);
    onSelect(`https://www.youtube.com/watch?v=${r.videoId}`, r.title);
  };

  const clear = () => {
    setSelected(null);
    setQuery("");
    setResults([]);
    onSelect("", "");
  };

  return (
    <div style={{ position: "relative" }}>
      <label style={{ fontSize: 12, color: "var(--text-secondary)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
        SEARCH FOR A SONG
      </label>

      {selected ? (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "rgba(226,27,27,0.08)",
          border: "1px solid rgba(226,27,27,0.3)",
          borderRadius: 10,
          padding: "8px 12px",
        }}>
          <img src={selected.thumbnail} alt="" style={{ width: 48, height: 36, borderRadius: 6, objectFit: "cover" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {selected.title}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{selected.channel}</p>
          </div>
          <button
            onClick={clear}
            style={{
              background: "var(--glass-2)",
              border: "1px solid var(--glass-border2)",
              borderRadius: 6,
              color: "var(--text-secondary)",
              padding: "4px 10px",
              cursor: "pointer",
              fontSize: 12,
              whiteSpace: "nowrap",
            }}
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <div style={{ position: "relative" }}>
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
              placeholder="e.g. Drake God's Plan, Kendrick HUMBLE..."
              autoComplete="off"
            />
            {loading && (
              <span style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 12,
                color: "var(--text-secondary)",
              }}>
                Searching…
              </span>
            )}
          </div>

          {error && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{error}</p>}

          {results.length > 0 && (
            <div style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 50,
              marginTop: 4,
              background: "var(--glass)",
              backdropFilter: "blur(28px) saturate(130%) brightness(1.03)",
              border: "1.5px solid var(--glass-border)",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 12px 40px var(--shadow-soft), 0 2px 8px var(--shadow-hard)",
            }}>
              {results.map((r) => (
                <button
                  key={r.videoId}
                  onClick={() => handleSelect(r)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "10px 12px",
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid rgba(30,26,20,0.08)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s",
                    color: "var(--text-dark)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(226,27,27,0.08)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <img src={r.thumbnail} alt="" style={{ width: 56, height: 42, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{
                      fontWeight: 600,
                      fontSize: 13,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      marginBottom: 2,
                    }}>
                      {r.title}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>{r.channel}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
