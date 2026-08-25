"use client";
import YouTubePlayer, { isMobileDevice } from "@/components/YouTubePlayer";
import StarVote from "@/components/StarVote";
import SongTimer from "@/components/SongTimer";
import SlideToSkip from "@/components/SlideToSkip";
import { getCategoryDescription, type SongSubmission } from "@/lib/gameState";

// Shared between /player and /room (when screenMode is "everyone") so both
// screens show the identical voting UI — song header, video, vote widget,
// category line, skip vote. /room adds its own host-only controls around
// this rather than maintaining a second, differently-laid-out copy.
export default function VotingScreen({
  currentSong, currentSongIndex, totalSongs, currentCategory,
  showVideo, isMyOwnSong, alreadyVoted, onVote,
  onVideoReady, songDuration, songStartedAt, onExpire,
  skipVoterIds, totalPlayers, myId, onSkipVote,
}: {
  currentSong: SongSubmission;
  currentSongIndex: number;
  totalSongs: number;
  currentCategory: string | null;
  showVideo: boolean;
  isMyOwnSong: boolean;
  alreadyVoted: boolean;
  onVote: (stars: number) => void;
  onVideoReady?: () => void;
  songDuration?: number | null;
  songStartedAt?: number | null;
  onExpire?: () => void;
  skipVoterIds: string[];
  totalPlayers: number;
  myId: string | null | undefined;
  onSkipVote: () => void;
}) {
  const iVotedSkip = skipVoterIds.includes(myId ?? "");
  const skipLabel = currentSongIndex + 1 >= totalSongs ? "Slide to see results" : "Slide to skip";
  return (
    <div style={{ width: "100%", maxWidth: showVideo ? 720 : 400, display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="text-center">
        <p style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--text-secondary)" }}>
          NOW PLAYING {currentSongIndex + 1}/{totalSongs}
        </p>
        <h3 style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{currentSong.title}</h3>
        {showVideo && songDuration && (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <SongTimer key={currentSongIndex} duration={songDuration} songStartedAt={songStartedAt ?? null} onExpire={onExpire} />
          </div>
        )}
      </div>

      {showVideo && (
        <>
          {isMobileDevice() && (
            <p style={{ color: "var(--text-secondary)", fontSize: 12, textAlign: "center", fontStyle: "italic" }}>
              🔊 Tap the video to play it with sound — phones block autoplay with audio
            </p>
          )}
          <YouTubePlayer frame="ipad" youtubeUrl={currentSong.youtubeUrl} startTime={currentSong.startTime} onReady={onVideoReady} />
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

      {/* Same "Category" badge card /room's one-screen-mode side panel
          uses (label + var(--font-ui), matching the "Next Song" button's
          font) — this used to be a plain inline line here, the one
          remaining visible difference between the two screens now that
          everyone-mode already shares this whole component. */}
      <div className="glass" style={{ width: "100%", boxSizing: "border-box", padding: "22px 20px", textAlign: "center", borderRadius: 28 }}>
        <p style={{ fontSize: 9, letterSpacing: "0.3em", color: "var(--text-faint)", textTransform: "uppercase", fontFamily: "'Cormorant Garamond', serif", marginBottom: 8 }}>
          Category
        </p>
        <p style={{ fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 20, letterSpacing: "0.01em", color: "var(--cream)", lineHeight: 1.35 }}>
          {currentCategory}
        </p>
        {getCategoryDescription(currentCategory) && (
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 13, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.4 }}>
            {getCategoryDescription(currentCategory)}
          </p>
        )}
      </div>

      {/* A majority (>50% of room.players) voting to skip advances the song
          immediately — see the "skip-vote" handler in server.ts. Slides,
          not taps, so it can't be triggered by an accidental single click. */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <SlideToSkip
          label={iVotedSkip ? `Waiting for others… (${skipVoterIds.length}/${totalPlayers})` : `${skipLabel} (${skipVoterIds.length}/${totalPlayers})`}
          onConfirm={onSkipVote}
          disabled={iVotedSkip}
        />
      </div>
    </div>
  );
}
