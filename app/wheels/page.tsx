"use client";
import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";

interface Category { id: string; name: string; }
interface Wheel { id: string; name: string; description: string | null; categories: Category[]; }

const lbl: React.CSSProperties = {
  fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase",
  color: "var(--text-secondary)", fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 300, display: "block", marginBottom: 10,
};

/* ── chip tag for a category ── */
function Chip({ name, onRemove }: { name: string; onRemove?: () => void }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      border: "1px solid rgba(242,236,227,0.15)", padding: "4px 10px",
      fontSize: 12, color: "var(--cream-dim)", fontFamily: "'Cormorant Garamond', serif",
    }}>
      {name}
      {onRemove && (
        <button onClick={onRemove} style={{
          background: "none", border: "none", color: "var(--text-faint)",
          cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1,
        }}>×</button>
      )}
    </span>
  );
}

/* ── inline wheel editor ── */
function WheelEditor({
  initial, onSave, onCancel,
}: {
  initial?: Wheel;
  onSave: (name: string, description: string, categories: string[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [cats, setCats] = useState<string[]>(initial?.categories.map(c => c.name) ?? []);
  const [catInput, setCatInput] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addCat = () => {
    const v = catInput.trim();
    if (!v) return;
    if (cats.includes(v)) { setCatInput(""); return; }
    setCats(p => [...p, v]);
    setCatInput("");
    inputRef.current?.focus();
  };

  const save = async () => {
    if (!name.trim()) return setError("Wheel name required");
    if (cats.length < 2) return setError("Add at least 2 categories");
    setSaving(true);
    try { await onSave(name, description, cats); }
    catch (e: any) { setError(e.message); setSaving(false); }
  };

  return (
    <div className="animate-fade-in" style={{ padding: "4px", display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <label style={lbl}>Wheel Name</label>
        <input value={name} onChange={e => { setName(e.target.value); setError(""); }} placeholder="e.g. Sad Girl Autumn" maxLength={50} autoFocus />
      </div>
      <div>
        <label style={lbl}>Description (optional)</label>
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="A vibe-based wheel for rainy days" maxLength={100} />
      </div>

      {/* Category builder */}
      <div>
        <label style={lbl}>Categories ({cats.length})</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            ref={inputRef}
            value={catInput}
            onChange={e => setCatInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCat())}
            placeholder="e.g. Breakup Songs"
            maxLength={40}
            style={{ flex: 1 }}
          />
          <button className="btn-glow" onClick={addCat} style={{ padding: "10px 20px", whiteSpace: "nowrap" }}>
            + Add
          </button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, minHeight: 36 }}>
          {cats.map((c, i) => (
            <Chip key={i} name={c} onRemove={() => setCats(p => p.filter((_, j) => j !== i))} />
          ))}
          {cats.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--text-faint)", fontStyle: "italic" }}>
              Type a category and press Enter or + Add
            </p>
          )}
        </div>
      </div>

      {error && <p style={{ color: "var(--danger)", fontSize: 12, fontStyle: "italic" }}>{error}</p>}

      <div style={{ display: "flex", gap: 12 }}>
        <button className="btn-glow" onClick={save} disabled={saving} style={{ flex: 1 }}>
          {saving ? "Saving…" : initial ? "Save Changes" : "Create Wheel"}
        </button>
        <button onClick={onCancel} style={{
          background: "transparent", border: "1px solid rgba(242,236,227,0.1)",
          color: "var(--text-secondary)", padding: "12px 20px", cursor: "pointer",
          fontFamily: "'Cormorant Garamond', serif", fontSize: 12, letterSpacing: "0.12em",
        }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── wheel row — a plain row now that it lives inside the one big box ── */
function WheelCard({ wheel, onEdit, onDelete }: { wheel: Wheel; onEdit: () => void; onDelete: () => void; }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="animate-fade-in" style={{ padding: "16px 4px", borderBottom: "1px solid rgba(242,236,227,0.08)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setExpanded(p => !p)}>
          <p style={{
            fontFamily: "'Pinyon Script', cursive", fontSize: 26,
            color: "var(--cream)", lineHeight: 1, marginBottom: 4,
          }}>{wheel.name}</p>
          {wheel.description && (
            <p style={{ fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic" }}>{wheel.description}</p>
          )}
          <p style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: "0.15em", marginTop: 6, fontFamily: "'Cormorant Garamond', serif" }}>
            {wheel.categories.length} categories · {expanded ? "collapse ▲" : "view ▼"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={onEdit} style={{
            background: "transparent", border: "1px solid rgba(242,236,227,0.12)",
            color: "var(--text-secondary)", padding: "6px 14px", cursor: "pointer",
            fontFamily: "'Cormorant Garamond', serif", fontSize: 11, letterSpacing: "0.15em",
          }}>Edit</button>
          <button onClick={onDelete} style={{
            background: "transparent", border: "1px solid rgba(200,30,30,0.2)",
            color: "rgba(200,30,30,0.6)", padding: "6px 14px", cursor: "pointer",
            fontFamily: "'Cormorant Garamond', serif", fontSize: 11, letterSpacing: "0.15em",
          }}>Delete</button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {wheel.categories.map(c => <Chip key={c.id} name={c.name} />)}
        </div>
      )}
    </div>
  );
}

/* ── main page ── */
export default function WheelsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [wheels, setWheels] = useState<Wheel[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Wheel | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth?callbackUrl=/wheels");
    if (status === "authenticated") fetchWheels();
  }, [status]);

  // Lock the page — no vertical scroll while on the wheels tab
  useEffect(() => {
    const { documentElement: html, body } = document;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  const fetchWheels = async () => {
    setLoading(true);
    const res = await fetch("/api/wheels");
    if (res.ok) setWheels(await res.json());
    setLoading(false);
  };

  const handleCreate = async (name: string, description: string, categories: string[]) => {
    const res = await fetch("/api/wheels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, categories }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    const wheel = await res.json();
    setWheels(p => [wheel, ...p]);
    setCreating(false);
  };

  const handleEdit = async (name: string, description: string, categories: string[]) => {
    if (!editing) return;
    const res = await fetch(`/api/wheels/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, categories }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    const updated = await res.json();
    setWheels(p => p.map(w => w.id === updated.id ? updated : w));
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this wheel?")) return;
    await fetch(`/api/wheels/${id}`, { method: "DELETE" });
    setWheels(p => p.filter(w => w.id !== id));
  };

  if (status === "loading" || (status === "unauthenticated")) {
    return (
      <div className="page">
        <div className="glass" style={{ padding: "32px 40px" }}>
          <p style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <img src="/my-wheels-background.webp" alt="" style={{
        position: "fixed", inset: 0, width: "100%", height: "100%",
        zIndex: 0, pointerEvents: "none", objectFit: "cover", objectPosition: "center",
      }}/>

      <div className="page" style={{ justifyContent: "flex-start", paddingTop: 84, paddingBottom: 60 }}>
      <TopBar />
      <div style={{ width: "100%", maxWidth: 680, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontFamily: "'Pinyon Script', cursive", fontSize: "clamp(2.5rem, 6vw, 4rem)", color: "var(--cream)", lineHeight: 0.9, margin: 0 }}>
              My Wheels
            </h1>
            <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 10, fontStyle: "italic" }}>
              Signed in as @{(session?.user as any)?.username}
            </p>
          </div>
          {!creating && !editing && (
            <button className="btn-glow" onClick={() => setCreating(true)}>
              + New Wheel
            </button>
          )}
        </div>

        {/* One big box — everything about your wheels lives here, with its
           own internal scroll so the page itself never needs to scroll. */}
        <div className="glass" style={{ padding: "28px 24px", height: 520, overflowY: "auto" }}>
          {/* Create form */}
          {creating && (
            <WheelEditor
              onSave={handleCreate}
              onCancel={() => setCreating(false)}
            />
          )}

          {/* Edit form */}
          {editing && (
            <WheelEditor
              initial={editing}
              onSave={handleEdit}
              onCancel={() => setEditing(null)}
            />
          )}

          {/* Wheel list */}
          {loading ? (
            <p style={{ color: "var(--text-faint)", fontStyle: "italic", textAlign: "center" }}>Loading…</p>
          ) : wheels.length === 0 && !creating ? (
            <div style={{ padding: "40px 24px", textAlign: "center" }}>
              <p style={{ fontFamily: "'Pinyon Script', cursive", fontSize: 32, color: "var(--cream-ghost)", marginBottom: 12 }}>
                No wheels yet
              </p>
              <p style={{ fontSize: 12, color: "var(--text-faint)", fontStyle: "italic", marginBottom: 24 }}>
                Create your first custom wheel to use it in Song Wars rooms
              </p>
              <button className="btn-glow" onClick={() => setCreating(true)}>Create a Wheel</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {wheels.map(w => (
                editing?.id === w.id ? null :
                <WheelCard
                  key={w.id}
                  wheel={w}
                  onEdit={() => { setCreating(false); setEditing(w); }}
                  onDelete={() => handleDelete(w.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
