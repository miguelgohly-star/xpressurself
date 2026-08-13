"use client";
import YouTubePlayer, { isMobileDevice } from "@/components/YouTubePlayer";
import StarVote from "@/components/StarVote";
import type { SongSubmission } from "@/lib/gameState";

// Shared between /player and /room (when screenMode is "everyone") so both
// screens show the identical voting UI — song header, video, vote widget,
// category line. /room adds its own host-only controls (Next Song, etc.)
// around this rather than maintaining a second, differently-laid-out copy.
export default function VotingScreen({
  currentSong, currentSongIndex, totalSongs, currentCategory,
  showVideo, isMyOwnSong, alreadyVoted, onVote,
}: {
  currentSong: SongSubmission;
  currentSongIndex: number;
  totalSongs: number;
  currentCategory: string | null;
  showVideo: boolean;
  isMyOwnSong: boolean;
  alreadyVoted: boolean;
  onVote: (stars: number) => void;
}) {
  return (
    <div style={{ width: "100%", maxWidth: showVideo ? 720 : 400, display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="text-center">
        <p style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--text-secondary)" }}>
          NOW PLAYING {currentSongIndex + 1}/{totalSongs}
        </p>
        <h3 style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{currentSong.title}</h3>
      </div>

      {showVideo && (
        <>
          {isMobileDevice() && (
            <p style={{ color: "var(--text-secondary)", fontSize: 12, textAlign: "center", fontStyle: "italic" }}>
              🔊 Tap the video to play it with sound — phones block autoplay with audio
            </p>
          )}
          <YouTubePlayer frame="ipad" youtubeUrl={currentSong.youtubeUrl} startTime={currentSong.startTime} />
        </>
      )}

      <div className="glass p-8 text-center">
        {isMyOwnSong ? (
          <div>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎤</div>
            <p style={{ fontWeight: 700 }}>This is your song!</p>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 8 }}>
              Others are voting on it now…
            </p>
          </div>
        ) : (
          <div>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
              Rate this song!
            </p>
            <StarVote onVote={onVote} voted={alreadyVoted} />
          </div>
        )}
      </div>

      <p style={{ color: "var(--text-secondary)", fontSize: 12, textAlign: "center" }}>
        Category: <strong style={{ color: "var(--cream)" }}>{currentCategory}</strong>
      </p>
    </div>
  );
}
