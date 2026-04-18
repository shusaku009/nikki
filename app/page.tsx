"use client";

import { createClient } from "@/lib/supabase";
import { useEffect, useState, useCallback } from "react";
import type { JournalRecord, Tag } from "@/types";

const MOOD_EMOJIS  = ["😭","😢","😞","😟","😕","😐","🙂","😊","😄","🤩"];
const MOOD_LABELS  = ["最悪","とても辛い","辛い","気が重い","少し辛い","ふつう","まぁいい","良い","とても良い","最高！"];

const TAG_DEFS = [
  { cat:"sleep",    val:"十分な睡眠",     cls:"good",   icon:"😴", label:"よく眠れた" },
  { cat:"sleep",    val:"睡眠不足",       cls:"danger", icon:"😵", label:"寝不足" },
  { cat:"caffeine", val:"カフェイン多め", cls:"warn",   icon:"☕", label:"カフェイン多め" },
  { cat:"caffeine", val:"カフェインなし", cls:"good",   icon:"🍵", label:"カフェインなし" },
  { cat:"exercise", val:"運動した",       cls:"good",   icon:"🏃", label:"運動した" },
  { cat:"exercise", val:"運動なし",       cls:"",       icon:"🛋️", label:"運動なし" },
  { cat:"meal",     val:"食事乱れ",       cls:"warn",   icon:"🍔", label:"食事乱れ" },
  { cat:"period",   val:"生理前後",       cls:"warn",   icon:"🌙", label:"生理前後" },
];

function Toast({ msg }: { msg: string }) {
  return (
    <div style={{
      position:"fixed", bottom:"28px", left:"50%",
      transform:"translateX(-50%)",
      background:"var(--surface2)", border:"1px solid var(--accent3)",
      color:"var(--accent3)", padding:"10px 22px", borderRadius:"30px",
      fontSize:"13px", letterSpacing:"0.06em", zIndex:100,
      animation:"fadeUp 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
    }}>{msg}</div>
  );
}

export default function HomePage() {
  const supabase = createClient();

  // フォーム状態
  const [eventText,   setEventText]   = useState("");
  const [emotionText, setEmotionText] = useState("");
  const [bodyText,    setBodyText]    = useState("");
  const [mood,        setMood]        = useState(5);
  const [activeTags,  setActiveTags]  = useState<Record<string,string>>({});

  // データ
  const [records,  setRecords]  = useState<JournalRecord[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState<string|null>(null);
  const [userEmail, setUserEmail] = useState<string|null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // セッション取得
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  // 記録取得
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/records");
    if (res.ok) setRecords(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // タグ選択（同カテゴリは排他）
  function toggleTag(cat: string, val: string, cls: string) {
    setActiveTags(prev => {
      if (prev[cat] === val) {
        const next = { ...prev };
        delete next[cat];
        return next;
      }
      return { ...prev, [cat]: val };
    });
  }

  // 保存
  async function saveRecord() {
    if (!eventText && !emotionText && !bodyText) {
      showToast("⚡ 少なくとも1つ入力してください");
      return;
    }
    setSaving(true);

    const tags: Tag[] = Object.entries(activeTags).map(([cat, val]) => {
      const def = TAG_DEFS.find(t => t.cat === cat && t.val === val);
      return { val, cls: def?.cls ?? "" };
    });

    const res = await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: eventText, emotion: emotionText, body_state: bodyText, mood, tags }),
    });

    if (res.ok) {
      setEventText(""); setEmotionText(""); setBodyText("");
      setMood(5); setActiveTags({});
      showToast("✦ 記録しました");
      fetchRecords();
    } else {
      showToast("⚠ 保存に失敗しました");
    }
    setSaving(false);
  }

  // ログアウト
  async function handleSignOut() {
    await supabase.auth.signOut();
    location.href = "/login";
  }

  // パターン分析
  function renderPattern() {
    if (records.length < 2) return null;
    const avgMood = records.reduce((s,r) => s + r.mood, 0) / records.length;
    const lowRecs = records.filter(r => r.mood <= 4);
    const tagCount: Record<string, number> = {};
    lowRecs.forEach(r => r.tags.forEach(t => { tagCount[t.val] = (tagCount[t.val]||0)+1; }));
    const topTags = Object.entries(tagCount).sort((a,b)=>b[1]-a[1]).slice(0,2);

    return (
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"14px", padding:"20px", marginBottom:"12px" }}>
        <h3 style={{ fontFamily:"'Noto Serif JP',serif", fontSize:"13px", fontWeight:400, color:"var(--accent3)", marginBottom:"14px", letterSpacing:"0.08em" }}>
          ✦ あなたのパターン分析
        </h3>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom: topTags.length > 0 ? "14px" : 0 }}>
          {[
            { label:"記録数",   val: records.length.toString(),                                              color:"var(--accent2)" },
            { label:"平均気分", val: `${MOOD_EMOJIS[Math.round(avgMood)-1]} ${avgMood.toFixed(1)}`,         color: avgMood>=7?"var(--good)":avgMood>=4?"var(--warn)":"var(--danger)" },
            { label:"気分が低い日", val: lowRecs.length.toString(),                                          color:"var(--danger)" },
            { label:"気分が良い日", val: records.filter(r=>r.mood>=7).length.toString(),                    color:"var(--good)" },
          ].map(item => (
            <div key={item.label} style={{ background:"var(--surface2)", borderRadius:"10px", padding:"12px 14px" }}>
              <div style={{ fontSize:"10px", color:"var(--text-muted)", letterSpacing:"0.08em", marginBottom:"4px" }}>{item.label}</div>
              <div style={{ fontSize:"18px", fontWeight:500, color:item.color }}>{item.val}</div>
            </div>
          ))}
        </div>
        {topTags.length > 0 && (
          <>
            <div style={{ fontSize:"11px", color:"var(--text-muted)", letterSpacing:"0.06em", marginBottom:"8px" }}>
              気分が低い日に多かった要因
            </div>
            {topTags.map(([name, cnt]) => (
              <div key={name} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid var(--border)", fontSize:"13px" }}>
                <span style={{ color:"var(--text)" }}>{name}</span>
                <span style={{ color:"var(--accent1)", fontSize:"12px" }}>気分低下時に {cnt}回</span>
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ position:"relative", minHeight:"100vh", background:"var(--bg)", color:"var(--text)", overflow:"hidden" }}>
      {/* bg mesh */}
      <div style={{
        position:"fixed", inset:0, pointerEvents:"none",
        background:`
          radial-gradient(ellipse 60% 40% at 20% 10%, rgba(165,152,232,0.12) 0%, transparent 60%),
          radial-gradient(ellipse 50% 50% at 80% 80%, rgba(232,165,152,0.10) 0%, transparent 60%),
          radial-gradient(ellipse 40% 60% at 60% 40%, rgba(152,232,212,0.07) 0%, transparent 60%)
        `,
      }} />

      <div style={{ position:"relative", zIndex:1, maxWidth:"720px", margin:"0 auto", padding:"32px 16px 80px" }}>
        {/* ヘッダー */}
        <header className="animate-fade-down" style={{ textAlign:"center", marginBottom:"40px" }}>
          <p style={{ fontSize:"11px", letterSpacing:"0.4em", color:"var(--text-muted)", marginBottom:"10px", fontFamily:"'Noto Serif JP',serif" }}>
            Mental Health Journal
          </p>
          <h1 style={{
            fontFamily:"'Noto Serif JP',serif", fontSize:"clamp(28px,7vw,40px)", fontWeight:300,
            background:"linear-gradient(135deg,var(--accent1),var(--accent2),var(--accent3))",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
            marginBottom:"8px",
          }}>こころ日記</h1>
          <p style={{ fontSize:"13px", color:"var(--text-muted)", lineHeight:1.8, fontWeight:300 }}>
            出来事・気持ち・体の状態を書き留めると<br />落ち込みや不安の"きっかけ"が見えてくる
          </p>
          {userEmail && (
            <div style={{ marginTop:"14px", display:"flex", alignItems:"center", justifyContent:"center", gap:"10px" }}>
              <span style={{ fontSize:"12px", color:"var(--text-muted)" }}>{userEmail}</span>
              <button onClick={handleSignOut} style={{
                fontSize:"11px", color:"var(--text-muted)", background:"none", border:"1px solid var(--border)",
                padding:"3px 10px", borderRadius:"20px", cursor:"pointer", fontFamily:"'Zen Kaku Gothic New',sans-serif",
              }}>ログアウト</button>
            </div>
          )}
        </header>

        {/* ---- 入力フォーム ---- */}
        {/* 出来事 */}
        <Section num="1" icon="🌿" title="出来事" hint="何があった？" delay="0s">
          <textarea
            value={eventText} onChange={e => setEventText(e.target.value)}
            placeholder="例）会議で発言できなかった、友達に既読スルーされた…"
            rows={2} style={textareaStyle()}
          />
        </Section>

        {/* 気持ち */}
        <Section num="2" icon="💭" title="気持ち" hint="どう感じた？" delay="0.08s">
          <textarea
            value={emotionText} onChange={e => setEmotionText(e.target.value)}
            placeholder="例）焦り・悲しみ・イライラ・むなしい・不安だった…"
            rows={2} style={textareaStyle()}
          />
          <div style={{ ...cardStyle(), marginTop:"10px", display:"flex", alignItems:"center", gap:"12px" }}>
            <span style={{ fontSize:"22px", minWidth:"28px", textAlign:"center" }}>
              {MOOD_EMOJIS[mood-1]}
            </span>
            <input
              type="range" min={1} max={10} value={mood}
              onChange={e => setMood(parseInt(e.target.value))}
              style={{ flex:1, accentColor:"var(--accent1)", height:"4px", cursor:"pointer" }}
            />
            <span style={{ fontSize:"12px", color:"var(--text-muted)", minWidth:"60px", textAlign:"right" }}>
              {MOOD_LABELS[mood-1]}
            </span>
          </div>
        </Section>

        {/* 体の状態 */}
        <Section num="3" icon="🫀" title="体の状態" hint="体はどうだった？" delay="0.16s">
          <textarea
            value={bodyText} onChange={e => setBodyText(e.target.value)}
            placeholder="例）頭痛・肩こり・ぼーっとする・疲れやすい…"
            rows={2} style={textareaStyle()}
          />
          <div style={{ display:"flex", flexWrap:"wrap", gap:"8px", marginTop:"12px" }}>
            {TAG_DEFS.map(t => {
              const isActive = activeTags[t.cat] === t.val;
              return (
                <button
                  key={t.val}
                  onClick={() => toggleTag(t.cat, t.val, t.cls)}
                  style={{
                    padding:"7px 14px", borderRadius:"20px",
                    border:`1px solid ${isActive ? tagBorderColor(t.cls) : "var(--border)"}`,
                    background: isActive ? tagBg(t.cls) : "var(--surface)",
                    color: isActive ? tagTextColor(t.cls) : "var(--text-muted)",
                    fontSize:"12px", cursor:"pointer",
                    fontFamily:"'Zen Kaku Gothic New',sans-serif",
                    transition:"all 0.2s",
                  }}
                >
                  {t.icon} {t.label}
                </button>
              );
            })}
          </div>
        </Section>

        {/* 保存ボタン */}
        <button
          onClick={saveRecord} disabled={saving}
          style={{
            width:"100%", padding:"16px",
            background:"linear-gradient(135deg,rgba(165,152,232,0.3),rgba(232,165,152,0.2))",
            border:"1px solid rgba(165,152,232,0.4)",
            borderRadius:"12px", color:"var(--text)",
            fontFamily:"'Zen Kaku Gothic New',sans-serif",
            fontSize:"14px", fontWeight:500, letterSpacing:"0.12em",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
            transition:"all 0.25s",
            marginBottom:"40px",
          }}
        >
          {saving ? "保存中…" : "✦ 記録する"}
        </button>

        {/* ---- 記録一覧 ---- */}
        <div style={{ display:"flex", alignItems:"center", gap:"16px", marginBottom:"28px" }}>
          <div style={{ flex:1, height:"1px", background:"var(--border)" }} />
          <span style={{ fontFamily:"'Noto Serif JP',serif", fontSize:"11px", letterSpacing:"0.3em", color:"var(--text-muted)" }}>
            記 録 と パ タ ー ン
          </span>
          <div style={{ flex:1, height:"1px", background:"var(--border)" }} />
        </div>

        {renderPattern()}

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"16px" }}>
          <span style={{ fontFamily:"'Noto Serif JP',serif", fontSize:"14px", color:"var(--text-muted)", letterSpacing:"0.1em" }}>
            過去の記録
          </span>
          {records.length > 0 && (
            <button
              onClick={async () => {
                if (!confirm("すべての記録を削除しますか？")) return;
                await fetch("/api/records", { method:"DELETE" });
                showToast("🗑 削除しました");
                fetchRecords();
              }}
              style={{ fontSize:"11px", color:"var(--text-muted)", background:"none", border:"none", cursor:"pointer", fontFamily:"'Zen Kaku Gothic New',sans-serif", padding:"4px 8px" }}
            >
              すべて削除
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign:"center", padding:"40px", color:"var(--text-muted)", fontSize:"13px" }}>読み込み中…</div>
        ) : records.length === 0 ? (
          <div style={{ textAlign:"center", padding:"40px", color:"var(--text-muted)" }}>
            <div style={{ fontSize:"36px", marginBottom:"12px", opacity:0.5 }}>🌿</div>
            <p style={{ fontSize:"13px", fontWeight:300, lineHeight:1.8 }}>まだ記録がありません<br />上のフォームから最初の記録を残してみよう</p>
          </div>
        ) : records.map((r, i) => <RecordCard key={r.id} record={r} index={i} onDelete={async (id) => {
          await fetch(`/api/records?id=${id}`, { method:"DELETE" });
          showToast("🗑 削除しました");
          fetchRecords();
        }} />)}
      </div>

      {toast && <Toast msg={toast} />}
    </div>
  );
}

// ---- サブコンポーネント ----

function Section({ num, icon, title, hint, delay, children }: {
  num:string; icon:string; title:string; hint:string; delay:string; children:React.ReactNode;
}) {
  return (
    <div className="animate-fade-up" style={{ marginBottom:"24px", animationDelay:delay }}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"12px" }}>
        <div style={{
          width:"26px", height:"26px", borderRadius:"50%",
          background:"var(--surface2)", border:"1px solid var(--border)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:"11px", color:"var(--text-muted)", flexShrink:0,
        }}>{num}</div>
        <span style={{ fontSize:"13px", fontWeight:500, letterSpacing:"0.08em" }}>{icon} {title}</span>
        <span style={{ fontSize:"11px", color:"var(--text-muted)", marginLeft:"auto" }}>{hint}</span>
      </div>
      {children}
    </div>
  );
}

function RecordCard({ record: r, index, onDelete }: { record: JournalRecord; index: number; onDelete: (id:string) => void }) {
  const d = new Date(r.created_at);
  const dateStr = `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;

  return (
    <div className="animate-fade-up" style={{
      background:"var(--surface)", border:"1px solid var(--border)",
      borderRadius:"14px", padding:"18px 20px", marginBottom:"10px",
      animationDelay:`${index*0.04}s`,
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"12px", flexWrap:"wrap" }}>
        <span style={{ fontSize:"11px", color:"var(--text-muted)" }}>{dateStr}</span>
        <span style={{ padding:"3px 10px", borderRadius:"10px", fontSize:"11px", background:"var(--surface2)" }}>
          {MOOD_EMOJIS[r.mood-1]} {MOOD_LABELS[r.mood-1]}
        </span>
        <div style={{ display:"flex", flexWrap:"wrap", gap:"5px", marginLeft:"auto" }}>
          {r.tags.map(t => (
            <span key={t.val} style={{ fontSize:"10px", padding:"2px 8px", borderRadius:"8px", background:"var(--surface2)", color:"var(--text-muted)" }}>
              {t.val}
            </span>
          ))}
        </div>
        <button
          onClick={() => onDelete(r.id)}
          style={{ fontSize:"11px", color:"var(--text-muted)", background:"none", border:"none", cursor:"pointer", marginLeft:"4px", padding:"2px 6px", fontFamily:"'Zen Kaku Gothic New',sans-serif" }}
        >✕</button>
      </div>
      <div style={{ display:"grid", gap:"8px" }}>
        {([["🌿","出来事",r.event],["💭","気持ち",r.emotion],["🫀","体の状態",r.body_state]] as [string,string,string|null][])
          .filter(([,,v]) => v)
          .map(([icon, label, val]) => (
            <div key={label} style={{ display:"flex", gap:"10px", alignItems:"flex-start" }}>
              <div style={{
                width:"20px", height:"20px", borderRadius:"50%",
                background:"var(--surface2)", display:"flex", alignItems:"center",
                justifyContent:"center", fontSize:"10px", flexShrink:0, marginTop:"2px",
              }}>{icon}</div>
              <div>
                <div style={{ fontSize:"10px", color:"var(--text-muted)", letterSpacing:"0.06em", marginBottom:"2px" }}>{label}</div>
                <div style={{ fontSize:"13px", fontWeight:300, lineHeight:1.6 }}>{val}</div>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ---- スタイルヘルパー ----
function textareaStyle(): React.CSSProperties {
  return {
    width:"100%", background:"var(--surface)", border:"1px solid var(--border)",
    borderRadius:"12px", padding:"14px 16px", color:"var(--text)",
    fontFamily:"'Zen Kaku Gothic New',sans-serif", fontSize:"15px", fontWeight:300,
    lineHeight:1.7, resize:"none", outline:"none",
  };
}

function cardStyle(): React.CSSProperties {
  return { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"12px", padding:"14px 16px" };
}

function tagBorderColor(cls: string) {
  return cls==="good"?"var(--good)":cls==="danger"?"var(--danger)":cls==="warn"?"var(--warn)":"var(--accent2)";
}

function tagBg(cls: string) {
  return cls==="good"?"rgba(122,232,160,0.12)":cls==="danger"?"rgba(232,122,122,0.12)":cls==="warn"?"rgba(232,208,122,0.12)":"rgba(165,152,232,0.15)";
}

function tagTextColor(cls: string) {
  return cls==="good"?"var(--good)":cls==="danger"?"var(--danger)":cls==="warn"?"var(--warn)":"var(--text)";
}
