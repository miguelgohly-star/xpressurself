export default function PlayerAvatar({
  name,
  avatarUrl,
  size = 26,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  return avatarUrl ? (
    <img
      src={avatarUrl}
      alt=""
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
    />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "var(--glass-2)", display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Pinyon Script', cursive", fontSize: size * 0.55, color: "var(--text-dark)",
    }}>
      {name[0]?.toUpperCase()}
    </div>
  );
}
