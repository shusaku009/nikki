"use client";

import { createClient } from "@/lib/supabase";
import { useEffect, useState, useCallback } from "react";
import type { JournalRecord, Tag, EntryType, ExtraData } from "@/types";

const MOOD_EMOJIS = ["😭","😢","😞","😟","😕","😐","🙂","😊","😄","🤩"];
const MOOD_LABELS = ["最悪","とても辛い","辛い","気が重い","少し辛い","ふつう","まぁいい","良い","とても良い","最高！"];

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

const MODE_TABS: { mode: EntryType; icon: string; label: string; desc: string }[] = [
  { mode: "standard",   icon: "🌿", label: "通常記録",       desc: "出来事・気持ち・体の状態" },
  { mode: "cbt",        icon: "🧠", label: "CBT思考記録",    desc: "思考を修正して行動を変える" },
  { mode: "suspicion",  icon: "🔍", label: "疑いダイアリー", desc: "不安の引き金を把握する" },
  { mode: "two_column", icon: "⚖️", label: "2カラムワーク",  desc: "事実と解釈を切り分ける" },
  { mode: "action_log", icon: "🎯", label: "行動ログ",       desc: "行動と結果を振り返る" },
];

const CBT_EMOTIONS = ["不安", "悲しみ", "怒り", "嫉妬", "恐れ", "罪悪感", "恥", "孤独感", "焦り", "絶望"];

const NG_WORDS = ["別れよう", "どうせ", "消えたい", "死にたい", "いなくなりたい", "もう無理", "終わりにしたい", "消えてしまいたい"];

const REFLECTION_HINTS = [
  "それって本当に証拠がある？思い込みかも？",
  "最悪の場合と最良の場合、どちらが現実的？",
  "友達が同じ状況だったら、なんて声をかける？",
  "この考えは事実？それとも自分の解釈？",
  "1年後も同じように感じていると思う？",
  "「〜に違いない」は本当に確かめた？",
];

function detectNgWord(texts: string[]): string | null {
  for (const text of texts) {
    for (const w of NG_WORDS) {
      if (text.includes(w)) return w;
    }
  }
  return null;
}

// ---- サブコンポーネント ----

function Toast({ msg }: { msg: string }) {
  return (
    <div style={{
      position:"fixed", bottom:"90px", left:"50%",
      transform:"translateX(-50%)",
      background:"var(--surface)", border:"1px solid var(--accent3)",
      color:"var(--accent3)", padding:"10px 22px", borderRadius:"30px",
      fontSize:"13px", letterSpacing:"0.06em", zIndex:100,
      animation:"fadeUp 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
      whiteSpace:"nowrap",
      boxShadow:"0 4px 16px rgba(43,34,30,0.1)",
    }}>{msg}</div>
  );
}

function TimerButton() {
  const [seconds, setSeconds] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (seconds === null) return;
    if (seconds <= 0) { setDone(true); setSeconds(null); return; }
    const t = setTimeout(() => setSeconds(s => (s ?? 0) - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const start = () => { setSeconds(30 * 60); setDone(false); };
  const reset = () => { setSeconds(null); setDone(false); };

  const mins = seconds !== null ? Math.floor(seconds / 60) : 0;
  const secs = seconds !== null ? seconds % 60 : 0;

  const base: React.CSSProperties = {
    fontFamily:"'Zen Kaku Gothic New',sans-serif",
    fontSize:"12px", letterSpacing:"0.06em",
    borderRadius:"30px", cursor:"pointer",
    padding:"9px 16px", transition:"all 0.25s",
    boxShadow:"0 2px 12px rgba(43,34,30,0.12)",
  };

  if (done) return (
    <button onClick={reset} style={{ ...base, background:"var(--surface)", border:"1px solid var(--good)", color:"var(--good)" }}>
      ✓ 30分経ちました
    </button>
  );

  if (seconds !== null) return (
    <button onClick={reset} style={{ ...base, background:"var(--accent1)", border:"1px solid var(--accent1)", color:"#fff" }}>
      ⏱ {String(mins).padStart(2,"0")}:{String(secs).padStart(2,"0")}
    </button>
  );

  return (
    <button onClick={start} style={{ ...base, background:"var(--surface)", border:"1px solid var(--border)", color:"var(--text-muted)" }}>
      ⏱ 30分待つ
    </button>
  );
}

function MoodSlider({ mood, setMood }: { mood: number; setMood: (v: number) => void }) {
  return (
    <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"12px", padding:"14px 16px", marginTop:"10px", display:"flex", alignItems:"center", gap:"12px" }}>
      <span style={{ fontSize:"22px", minWidth:"28px", textAlign:"center" }}>{MOOD_EMOJIS[mood-1]}</span>
      <input
        type="range" min={1} max={10} value={mood}
        onChange={e => setMood(parseInt(e.target.value))}
        style={{ flex:1, accentColor:"var(--accent1)", height:"4px", cursor:"pointer" }}
      />
      <span style={{ fontSize:"12px", color:"var(--text-muted)", minWidth:"60px", textAlign:"right" }}>
        {MOOD_LABELS[mood-1]}
      </span>
    </div>
  );
}

function TagSelector({ activeTags, toggleTag }: { activeTags: Record<string,string>; toggleTag: (cat:string, val:string) => void }) {
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:"8px", marginTop:"12px" }}>
      {TAG_DEFS.map(t => {
        const isActive = activeTags[t.cat] === t.val;
        return (
          <button key={t.val} onClick={() => toggleTag(t.cat, t.val)} style={{
            padding:"7px 14px", borderRadius:"20px",
            border:`1px solid ${isActive ? tagBorderColor(t.cls) : "var(--border)"}`,
            background: isActive ? tagBg(t.cls) : "var(--surface)",
            color: isActive ? tagTextColor(t.cls) : "var(--text-muted)",
            fontSize:"12px", cursor:"pointer",
            fontFamily:"'Zen Kaku Gothic New',sans-serif",
            transition:"all 0.2s",
          }}>
            {t.icon} {t.label}
          </button>
        );
      })}
    </div>
  );
}

function Section({ num, icon, title, hint, delay, children }: {
  num:string; icon:string; title:string; hint:string; delay:string; children:React.ReactNode;
}) {
  return (
    <div className="animate-fade-up" style={{ marginBottom:"24px", animationDelay:delay }}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"12px" }}>
        <div style={{
          width:"26px", height:"26px", borderRadius:"50%",
          background:"var(--surface)", border:"1px solid var(--border)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:"11px", color:"var(--accent1)", fontWeight:500, flexShrink:0,
        }}>{num}</div>
        <span style={{ fontSize:"13px", fontWeight:500, letterSpacing:"0.08em", color:"var(--text)" }}>{icon} {title}</span>
        <span style={{ fontSize:"11px", color:"var(--text-muted)", marginLeft:"auto" }}>{hint}</span>
      </div>
      {children}
    </div>
  );
}

function FieldRow({ icon, label, val }: { icon: string; label: string; val: string }) {
  return (
    <div style={{ display:"flex", gap:"10px", alignItems:"flex-start" }}>
      <div style={{
        width:"20px", height:"20px", borderRadius:"50%",
        background:"var(--surface2)", display:"flex", alignItems:"center",
        justifyContent:"center", fontSize:"10px", flexShrink:0, marginTop:"2px",
      }}>{icon}</div>
      <div>
        <div style={{ fontSize:"10px", color:"var(--text-muted)", letterSpacing:"0.06em", marginBottom:"2px" }}>{label}</div>
        <div style={{ fontSize:"13px", fontWeight:300, lineHeight:1.6, color:"var(--text)" }}>{val}</div>
      </div>
    </div>
  );
}

function MoodGraph({ records }: { records: JournalRecord[] }) {
  const pts = [...records].reverse().slice(-14);
  if (pts.length < 2) return null;
  const W = 300, H = 80, PX = 12, PY = 14;
  const innerW = W - PX * 2;
  const innerH = H - PY * 2;
  const xAt = (i: number) => PX + (pts.length > 1 ? i * innerW / (pts.length - 1) : 0);
  const yAt = (m: number) => PY + innerH * (1 - (m - 1) / 9);
  const points = pts.map((r, i) => ({ x: xAt(i), y: yAt(r.mood), mood: r.mood }));
  const polyline = points.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <div style={{ background:"var(--surface2)", borderRadius:"10px", padding:"12px 14px", marginBottom:"10px" }}>
      <div style={{ fontSize:"10px", color:"var(--text-muted)", letterSpacing:"0.08em", marginBottom:"8px" }}>
        気分の推移（直近{pts.length}件）
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow:"visible", display:"block" }}>
        {[3, 5, 7].map(m => (
          <line key={m} x1={PX} y1={yAt(m)} x2={W - PX} y2={yAt(m)}
            stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
        ))}
        <polyline points={polyline} fill="none" stroke="var(--accent1)" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill="var(--accent1)" />
            {(pts.length <= 8 || i === 0 || i === pts.length - 1) && (
              <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fill="var(--text-muted)">
                {MOOD_EMOJIS[p.mood - 1]}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function EmotionChart({ records }: { records: JournalRecord[] }) {
  const cbtRecs = records.filter(r => r.entry_type === "cbt");
  if (cbtRecs.length === 0) return null;
  const emotionCount: Record<string, number> = {};
  cbtRecs.forEach(r => {
    (r.extra_data?.emotionTypes ?? []).forEach(e => {
      emotionCount[e.name] = (emotionCount[e.name] || 0) + 1;
    });
  });
  const sorted = Object.entries(emotionCount).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (sorted.length === 0) return null;
  const max = sorted[0][1];
  return (
    <div style={{ background:"var(--surface2)", borderRadius:"10px", padding:"12px 14px", marginBottom:"10px" }}>
      <div style={{ fontSize:"10px", color:"var(--text-muted)", letterSpacing:"0.08em", marginBottom:"10px" }}>
        感情の頻度（CBT記録より）
      </div>
      {sorted.map(([name, cnt]) => (
        <div key={name} style={{ marginBottom:"8px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:"11px", color:"var(--text)", marginBottom:"3px" }}>
            <span>{name}</span>
            <span style={{ color:"var(--text-muted)" }}>{cnt}回</span>
          </div>
          <div style={{ height:"4px", background:"var(--border)", borderRadius:"2px" }}>
            <div style={{ height:"4px", background:"var(--accent1)", borderRadius:"2px", width:`${(cnt / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ReflectionHint({ text }: { text: string }) {
  if (text.length < 10) return null;
  const hint = REFLECTION_HINTS[text.length % REFLECTION_HINTS.length];
  return (
    <div style={{
      background:"rgba(100,80,180,0.07)", border:"1px solid rgba(100,80,180,0.2)",
      borderRadius:"10px", padding:"10px 14px", marginTop:"8px",
      display:"flex", gap:"10px", alignItems:"flex-start",
    }}>
      <span style={{ fontSize:"14px", flexShrink:0 }}>🤔</span>
      <div>
        <div style={{ fontSize:"10px", color:"var(--text-muted)", marginBottom:"3px", letterSpacing:"0.06em" }}>自動ツッコミ</div>
        <div style={{ fontSize:"12px", color:"var(--text)", lineHeight:1.7 }}>{hint}</div>
      </div>
    </div>
  );
}

function NgWordBanner() {
  return (
    <div style={{
      background:"rgba(184,80,80,0.08)", border:"1px solid var(--danger)",
      borderRadius:"12px", padding:"14px 16px", marginBottom:"20px",
    }}>
      <div style={{ fontSize:"13px", color:"var(--danger)", fontWeight:500, marginBottom:"6px" }}>
        ⚠ 今、つらい気持ちがありますか？
      </div>
      <div style={{ fontSize:"12px", color:"var(--text)", lineHeight:1.9 }}>
        一人で抱え込まないでください。<br />
        <strong>よりそいホットライン</strong>:{" "}
        <a href="tel:0120279338" style={{ color:"var(--accent1)" }}>0120-279-338</a>（24時間・無料）
      </div>
    </div>
  );
}

function RecordCard({ record: r, index, onDelete }: { record: JournalRecord; index: number; onDelete: (id:string) => void }) {
  const d = new Date(r.created_at);
  const dateStr = `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  const entryType = r.entry_type ?? "standard";
  const ed: ExtraData = r.extra_data ?? {};

  const modeInfo = ({
    standard:   { label:"🌿 通常記録",       bg:"var(--surface2)" },
    cbt:        { label:"🧠 CBT思考記録",    bg:"rgba(100,80,180,0.1)" },
    action_log: { label:"🎯 行動ログ",       bg:"rgba(74,138,102,0.1)" },
    suspicion:  { label:"🔍 疑いダイアリー", bg:"rgba(201,97,74,0.1)" },
    two_column: { label:"⚖️ 2カラムワーク",  bg:"rgba(77,128,104,0.1)" },
  } as Record<string, { label:string; bg:string }>)[entryType] ?? { label:"🌿 通常記録", bg:"var(--surface2)" };

  function renderContent() {
    if (entryType === "action_log") {
      return (
        <div style={{ display:"grid", gap:"8px" }}>
          {([
            ["📍", "状況",       r.event],
            ["💭", "感情",       r.emotion],
            ["🎯", "とった行動", ed.actionTaken],
            ["📊", "結果",       ed.resultType],
            ["💡", "学び",       ed.learning],
          ] as [string, string, string | null | undefined][])
            .filter(([,, v]) => v)
            .map(([icon, label, val]) => <FieldRow key={label} icon={icon} label={label} val={val!} />)}
          {typeof ed.tenMinRule === "boolean" && (
            <FieldRow icon="⏱" label="10分ルール" val={ed.tenMinRule ? "✓ 使った" : "使わなかった"} />
          )}
        </div>
      );
    }

    if (entryType === "cbt") {
      const emoStr = (ed.emotionTypes ?? []).map(e => `${e.name} ${e.percent}%`).join(" / ");
      return (
        <div style={{ display:"grid", gap:"8px" }}>
          {([
            ["🌿", "出来事",    r.event],
            ["💭", "自動思考",  ed.autoThought],
            ["📊", "感情",      emoStr || null],
            ["🔍", "証拠・事実", ed.evidence],
            ["🌀", "別の解釈",  ed.altInterpretation],
            ["🎯", "行動計画",  ed.actionPlan],
          ] as [string, string, string | null | undefined][])
            .filter(([,, v]) => v)
            .map(([icon, label, val]) => <FieldRow key={label} icon={icon} label={label} val={val!} />)}
        </div>
      );
    }

    if (entryType === "suspicion") {
      return (
        <div style={{ display:"grid", gap:"8px" }}>
          {([ ["📍","状況",ed.situation], ["💓","体の反応",ed.bodyReaction], ["💭","頭に浮かんだこと",ed.thought], ["✅","実際どうだったか",ed.actual] ] as [string,string,string|undefined][])
            .filter(([,,v]) => v)
            .map(([icon, label, val]) => <FieldRow key={label} icon={icon} label={label} val={val!} />)}
        </div>
      );
    }

    if (entryType === "two_column") {
      const alts = ed.alternatives ?? [];
      return (
        <div style={{ display:"grid", gap:"8px" }}>
          {([ ["📋","事実",ed.fact], ["🔮","自分の解釈",ed.interpretation] ] as [string,string,string|undefined][])
            .filter(([,,v]) => v)
            .map(([icon, label, val]) => <FieldRow key={label} icon={icon} label={label} val={val!} />)}
          {alts.length > 0 && (
            <div style={{ display:"flex", gap:"10px", alignItems:"flex-start" }}>
              <div style={{ width:"20px", height:"20px", borderRadius:"50%", background:"var(--surface2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"10px", flexShrink:0, marginTop:"2px" }}>🌀</div>
              <div>
                <div style={{ fontSize:"10px", color:"var(--text-muted)", letterSpacing:"0.06em", marginBottom:"4px" }}>他の可能性</div>
                {alts.map((alt, i) => (
                  <div key={i} style={{ fontSize:"13px", fontWeight:300, lineHeight:1.6, color:"var(--text)" }}>・{alt}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    const acc = ed.accomplishments ?? [];
    return (
      <div style={{ display:"grid", gap:"8px" }}>
        {([ ["🌿","出来事",r.event], ["💭","気持ち",r.emotion], ["🫀","体の状態",r.body_state] ] as [string,string,string|null][])
          .filter(([,,v]) => v)
          .map(([icon, label, val]) => <FieldRow key={label} icon={icon} label={label} val={val!} />)}
        {acc.length > 0 && (
          <div style={{ display:"flex", gap:"10px", alignItems:"flex-start" }}>
            <div style={{ width:"20px", height:"20px", borderRadius:"50%", background:"var(--surface2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"10px", flexShrink:0, marginTop:"2px" }}>⭐</div>
            <div>
              <div style={{ fontSize:"10px", color:"var(--text-muted)", letterSpacing:"0.06em", marginBottom:"4px" }}>できたこと</div>
              {acc.map((a, i) => (
                <div key={i} style={{ fontSize:"13px", fontWeight:300, lineHeight:1.6, color:"var(--text)" }}>・{a}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-up" style={{
      background:"var(--surface)", border:"1px solid var(--border)",
      borderRadius:"14px", padding:"18px 20px", marginBottom:"10px",
      animationDelay:`${index*0.04}s`,
      boxShadow:"0 1px 4px rgba(43,34,30,0.06)",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"12px", flexWrap:"wrap" }}>
        <span style={{ fontSize:"11px", color:"var(--text-muted)" }}>{dateStr}</span>
        <span style={{ padding:"3px 9px", borderRadius:"10px", fontSize:"10px", background:modeInfo.bg, letterSpacing:"0.04em", color:"var(--text-muted)" }}>{modeInfo.label}</span>
        <span style={{ padding:"3px 10px", borderRadius:"10px", fontSize:"11px", background:"var(--surface2)" }}>
          {MOOD_EMOJIS[r.mood-1]} {MOOD_LABELS[r.mood-1]}
        </span>
        <div style={{ display:"flex", flexWrap:"wrap", gap:"5px", marginLeft:"auto" }}>
          {(r.tags ?? []).map(t => (
            <span key={t.val} style={{ fontSize:"10px", padding:"2px 8px", borderRadius:"8px", background:"var(--surface2)", color:"var(--text-muted)" }}>
              {t.val}
            </span>
          ))}
        </div>
        <button onClick={() => onDelete(r.id)} style={{ fontSize:"11px", color:"var(--text-muted)", background:"none", border:"none", cursor:"pointer", padding:"2px 6px", fontFamily:"'Zen Kaku Gothic New',sans-serif" }}>✕</button>
      </div>
      {renderContent()}
    </div>
  );
}

// ---- メインページ ----

export default function HomePage() {
  const supabase = createClient();

  const [mode, setMode] = useState<EntryType>("standard");

  // standard
  const [eventText,       setEventText]       = useState("");
  const [emotionText,     setEmotionText]     = useState("");
  const [bodyText,        setBodyText]        = useState("");
  const [mood,            setMood]            = useState(5);
  const [activeTags,      setActiveTags]      = useState<Record<string,string>>({});
  const [accomplishments, setAccomplishments] = useState(["","",""]);

  // suspicion
  const [situation,    setSituation]    = useState("");
  const [bodyReaction, setBodyReaction] = useState("");
  const [thought,      setThought]      = useState("");
  const [actual,       setActual]       = useState("");
  const [suspMood,     setSuspMood]     = useState(5);

  // two_column
  const [fact,           setFact]           = useState("");
  const [interpretation, setInterpretation] = useState("");
  const [alternatives,   setAlternatives]   = useState(["","",""]);
  const [twoMood,        setTwoMood]        = useState(5);

  // cbt
  const [cbtEvent,       setCbtEvent]       = useState("");
  const [cbtAutoThought, setCbtAutoThought] = useState("");
  const [cbtEmotions,    setCbtEmotions]    = useState<{ name: string; percent: number }[]>([]);
  const [cbtEvidence,    setCbtEvidence]    = useState("");
  const [cbtAltInterp,   setCbtAltInterp]   = useState("");
  const [cbtActionPlan,  setCbtActionPlan]  = useState("");
  const [cbtMood,        setCbtMood]        = useState(5);

  // action_log
  const [alSituation, setAlSituation] = useState("");
  const [alEmotion,   setAlEmotion]   = useState("");
  const [alAction,    setAlAction]    = useState("");
  const [alTenMin,    setAlTenMin]    = useState(false);
  const [alResult,    setAlResult]    = useState("微妙");
  const [alLearning,  setAlLearning]  = useState("");
  const [alMood,      setAlMood]      = useState(5);

  // data / ui
  const [records,   setRecords]   = useState<JournalRecord[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [toast,     setToast]     = useState<string|null>(null);
  const [userEmail, setUserEmail] = useState<string|null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/records");
    if (res.ok) setRecords(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  function toggleTag(cat: string, val: string) {
    setActiveTags(prev => {
      if (prev[cat] === val) { const next = { ...prev }; delete next[cat]; return next; }
      return { ...prev, [cat]: val };
    });
  }

  function toggleCbtEmotion(name: string) {
    setCbtEmotions(prev => {
      if (prev.find(e => e.name === name)) return prev.filter(e => e.name !== name);
      return [...prev, { name, percent: 50 }];
    });
  }

  function updateCbtEmotionPercent(name: string, percent: number) {
    setCbtEmotions(prev => prev.map(e => e.name === name ? { ...e, percent } : e));
  }

  async function saveRecord() {
    setSaving(true);
    let body: Record<string, unknown>;

    if (mode === "standard") {
      if (!eventText && !emotionText && !bodyText && accomplishments.every(a => !a)) {
        showToast("⚡ 少なくとも1つ入力してください"); setSaving(false); return;
      }
      const tags: Tag[] = Object.entries(activeTags).map(([cat, val]) => {
        const def = TAG_DEFS.find(t => t.cat === cat && t.val === val);
        return { val, cls: def?.cls ?? "" };
      });
      body = {
        entry_type: "standard", event: eventText||null, emotion: emotionText||null,
        body_state: bodyText||null, mood, tags,
        extra_data: { accomplishments: accomplishments.filter(a => a.trim()) },
      };
    } else if (mode === "cbt") {
      if (!cbtEvent && !cbtAutoThought) {
        showToast("⚡ 出来事か自動思考を入力してください"); setSaving(false); return;
      }
      body = {
        entry_type: "cbt", event: cbtEvent||null, emotion: null, body_state: null,
        mood: cbtMood, tags: [],
        extra_data: {
          autoThought: cbtAutoThought,
          emotionTypes: cbtEmotions,
          evidence: cbtEvidence,
          altInterpretation: cbtAltInterp,
          actionPlan: cbtActionPlan,
        },
      };
    } else if (mode === "action_log") {
      if (!alSituation && !alAction) {
        showToast("⚡ 状況か行動を入力してください"); setSaving(false); return;
      }
      body = {
        entry_type: "action_log", event: alSituation||null, emotion: alEmotion||null, body_state: null,
        mood: alMood, tags: [],
        extra_data: { actionTaken: alAction, tenMinRule: alTenMin, resultType: alResult, learning: alLearning },
      };
    } else if (mode === "suspicion") {
      if (!situation && !thought) {
        showToast("⚡ 状況か頭に浮かんだことを入力してください"); setSaving(false); return;
      }
      body = {
        entry_type: "suspicion", event: null, emotion: null, body_state: null,
        mood: suspMood, tags: [],
        extra_data: { situation, bodyReaction, thought, actual },
      };
    } else {
      if (!fact && !interpretation) {
        showToast("⚡ 事実か解釈を入力してください"); setSaving(false); return;
      }
      body = {
        entry_type: "two_column", event: null, emotion: null, body_state: null,
        mood: twoMood, tags: [],
        extra_data: { fact, interpretation, alternatives: alternatives.filter(a => a.trim()) },
      };
    }

    const res = await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      if (mode === "standard") {
        setEventText(""); setEmotionText(""); setBodyText("");
        setMood(5); setActiveTags({}); setAccomplishments(["","",""]);
      } else if (mode === "cbt") {
        setCbtEvent(""); setCbtAutoThought(""); setCbtEmotions([]);
        setCbtEvidence(""); setCbtAltInterp(""); setCbtActionPlan(""); setCbtMood(5);
      } else if (mode === "action_log") {
        setAlSituation(""); setAlEmotion(""); setAlAction("");
        setAlTenMin(false); setAlResult("微妙"); setAlLearning(""); setAlMood(5);
      } else if (mode === "suspicion") {
        setSituation(""); setBodyReaction(""); setThought(""); setActual(""); setSuspMood(5);
      } else {
        setFact(""); setInterpretation(""); setAlternatives(["","",""]); setTwoMood(5);
      }
      showToast("✦ 記録しました");
      fetchRecords();
    } else {
      showToast("⚠ 保存に失敗しました");
    }
    setSaving(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    location.href = "/login";
  }

  const allTexts = [eventText, emotionText, bodyText, situation, bodyReaction, thought, actual, fact, interpretation, ...alternatives, cbtEvent, cbtAutoThought, cbtEvidence, cbtAltInterp, cbtActionPlan, alSituation, alEmotion, alAction, alLearning];
  const detectedNg = detectNgWord(allTexts);

  function renderPattern() {
    if (records.length < 2) return null;
    const avgMood = records.reduce((s, r) => s + r.mood, 0) / records.length;
    const lowRecs = records.filter(r => r.mood <= 4);
    const tagCount: Record<string, number> = {};
    lowRecs.forEach(r => (r.tags ?? []).forEach(t => { tagCount[t.val] = (tagCount[t.val]||0)+1; }));
    const topTags = Object.entries(tagCount).sort((a, b) => b[1]-a[1]).slice(0, 2);
    const accDays   = records.filter(r => (r.entry_type ?? "standard") === "standard" && (r.extra_data?.accomplishments ?? []).length > 0).length;
    const suspDays  = records.filter(r => r.entry_type === "suspicion").length;
    const twoCols   = records.filter(r => r.entry_type === "two_column").length;
    const cbtDays   = records.filter(r => r.entry_type === "cbt").length;
    const actionDays = records.filter(r => r.entry_type === "action_log").length;
    const tenMinUsed = records.filter(r => r.entry_type === "action_log" && r.extra_data?.tenMinRule === true).length;
    const goodResults = records.filter(r => r.entry_type === "action_log" && r.extra_data?.resultType === "良かった").length;

    return (
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"14px", padding:"20px", marginBottom:"12px", boxShadow:"0 1px 4px rgba(43,34,30,0.06)" }}>
        <h3 style={{ fontFamily:"'Noto Serif JP',serif", fontSize:"13px", fontWeight:400, color:"var(--accent3)", marginBottom:"14px", letterSpacing:"0.08em" }}>
          ✦ あなたのパターン分析
        </h3>

        <MoodGraph records={records} />
        <EmotionChart records={records} />

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"10px" }}>
          {[
            { label:"記録数",       val: records.length.toString(),                                      color:"var(--accent2)" },
            { label:"平均気分",     val: `${MOOD_EMOJIS[Math.round(avgMood)-1]} ${avgMood.toFixed(1)}`, color: avgMood>=7?"var(--good)":avgMood>=4?"var(--warn)":"var(--danger)" },
            { label:"気分が低い日", val: lowRecs.length.toString(),                                      color:"var(--danger)" },
            { label:"気分が良い日", val: records.filter(r => r.mood>=7).length.toString(),              color:"var(--good)" },
          ].map(item => (
            <div key={item.label} style={{ background:"var(--surface2)", borderRadius:"10px", padding:"12px 14px" }}>
              <div style={{ fontSize:"10px", color:"var(--text-muted)", letterSpacing:"0.08em", marginBottom:"4px" }}>{item.label}</div>
              <div style={{ fontSize:"18px", fontWeight:500, color:item.color }}>{item.val}</div>
            </div>
          ))}
        </div>

        {(accDays > 0 || suspDays > 0 || twoCols > 0 || cbtDays > 0 || actionDays > 0) && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(80px,1fr))", gap:"8px", marginBottom:"14px" }}>
            {accDays > 0 && (
              <div style={{ background:"var(--surface2)", borderRadius:"10px", padding:"10px 12px", textAlign:"center" }}>
                <div style={{ fontSize:"10px", color:"var(--text-muted)", marginBottom:"2px" }}>できたこと記録</div>
                <div style={{ fontSize:"16px", fontWeight:500, color:"var(--good)" }}>{accDays}日</div>
              </div>
            )}
            {cbtDays > 0 && (
              <div style={{ background:"var(--surface2)", borderRadius:"10px", padding:"10px 12px", textAlign:"center" }}>
                <div style={{ fontSize:"10px", color:"var(--text-muted)", marginBottom:"2px" }}>CBT思考記録</div>
                <div style={{ fontSize:"16px", fontWeight:500, color:"rgba(100,80,180,0.9)" }}>{cbtDays}回</div>
              </div>
            )}
            {suspDays > 0 && (
              <div style={{ background:"var(--surface2)", borderRadius:"10px", padding:"10px 12px", textAlign:"center" }}>
                <div style={{ fontSize:"10px", color:"var(--text-muted)", marginBottom:"2px" }}>疑いダイアリー</div>
                <div style={{ fontSize:"16px", fontWeight:500, color:"var(--accent1)" }}>{suspDays}回</div>
              </div>
            )}
            {twoCols > 0 && (
              <div style={{ background:"var(--surface2)", borderRadius:"10px", padding:"10px 12px", textAlign:"center" }}>
                <div style={{ fontSize:"10px", color:"var(--text-muted)", marginBottom:"2px" }}>2カラムワーク</div>
                <div style={{ fontSize:"16px", fontWeight:500, color:"var(--accent3)" }}>{twoCols}回</div>
              </div>
            )}
            {actionDays > 0 && (
              <div style={{ background:"var(--surface2)", borderRadius:"10px", padding:"10px 12px", textAlign:"center" }}>
                <div style={{ fontSize:"10px", color:"var(--text-muted)", marginBottom:"2px" }}>行動ログ</div>
                <div style={{ fontSize:"16px", fontWeight:500, color:"var(--good)" }}>{actionDays}回</div>
              </div>
            )}
            {tenMinUsed > 0 && (
              <div style={{ background:"var(--surface2)", borderRadius:"10px", padding:"10px 12px", textAlign:"center" }}>
                <div style={{ fontSize:"10px", color:"var(--text-muted)", marginBottom:"2px" }}>10分ルール</div>
                <div style={{ fontSize:"16px", fontWeight:500, color:"var(--good)" }}>{tenMinUsed}回</div>
              </div>
            )}
            {goodResults > 0 && (
              <div style={{ background:"var(--surface2)", borderRadius:"10px", padding:"10px 12px", textAlign:"center" }}>
                <div style={{ fontSize:"10px", color:"var(--text-muted)", marginBottom:"2px" }}>行動が良かった</div>
                <div style={{ fontSize:"16px", fontWeight:500, color:"var(--good)" }}>{goodResults}回</div>
              </div>
            )}
          </div>
        )}

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

  function renderForm() {
    if (mode === "standard") return (
      <>
        <Section num="1" icon="🌿" title="出来事" hint="何があった？" delay="0s">
          <textarea value={eventText} onChange={e => setEventText(e.target.value)}
            placeholder="例）会議で発言できなかった、友達に既読スルーされた…"
            rows={2} style={textareaStyle()} />
        </Section>
        <Section num="2" icon="💭" title="気持ち" hint="どう感じた？" delay="0.08s">
          <textarea value={emotionText} onChange={e => setEmotionText(e.target.value)}
            placeholder="例）焦り・悲しみ・イライラ・むなしい・不安だった…"
            rows={2} style={textareaStyle()} />
          <MoodSlider mood={mood} setMood={setMood} />
        </Section>
        <Section num="3" icon="🫀" title="体の状態" hint="体はどうだった？" delay="0.16s">
          <textarea value={bodyText} onChange={e => setBodyText(e.target.value)}
            placeholder="例）頭痛・肩こり・ぼーっとする・疲れやすい…"
            rows={2} style={textareaStyle()} />
          <TagSelector activeTags={activeTags} toggleTag={toggleTag} />
        </Section>
        <Section num="4" icon="⭐" title="できたこと" hint="今日よかったことを3つ" delay="0.24s">
          <div style={{ display:"grid", gap:"8px" }}>
            {accomplishments.map((a, i) => (
              <input key={i} value={a}
                onChange={e => setAccomplishments(prev => prev.map((v, j) => j===i ? e.target.value : v))}
                placeholder={`${i+1}. 例）ちゃんとご飯を作れた、散歩できた…`}
                style={inputStyle()} />
            ))}
          </div>
        </Section>
      </>
    );

    if (mode === "cbt") return (
      <>
        <div style={{ background:"rgba(100,80,180,0.06)", border:"1px solid rgba(100,80,180,0.2)", borderRadius:"12px", padding:"14px 16px", marginBottom:"24px", fontSize:"12px", color:"var(--text-muted)", lineHeight:1.8 }}>
          つらい出来事があったとき、6ステップで思考パターンを修正しましょう。<br />
          続けることで「自動思考のクセ」が見えてきます。
        </div>
        <Section num="1" icon="🌿" title="出来事" hint="何があった？" delay="0s">
          <textarea value={cbtEvent} onChange={e => setCbtEvent(e.target.value)}
            placeholder="例）パートナーから冷たい返信が来た"
            rows={2} style={textareaStyle()} />
        </Section>
        <Section num="2" icon="💭" title="自動思考" hint="頭に浮かんだ考え" delay="0.06s">
          <textarea value={cbtAutoThought} onChange={e => setCbtAutoThought(e.target.value)}
            placeholder="例）「嫌われたかも」「もう終わりかも」「自分が悪い」…"
            rows={2} style={textareaStyle()} />
          <ReflectionHint text={cbtAutoThought} />
        </Section>
        <Section num="3" icon="📊" title="感情と強度" hint="何%感じた？" delay="0.12s">
          <div style={{ display:"flex", flexWrap:"wrap", gap:"8px", marginBottom:"10px" }}>
            {CBT_EMOTIONS.map(name => {
              const selected = cbtEmotions.find(e => e.name === name);
              return (
                <button key={name} onClick={() => toggleCbtEmotion(name)} style={{
                  padding:"6px 14px", borderRadius:"20px", fontSize:"12px", cursor:"pointer",
                  border:`1px solid ${selected ? "var(--accent1)" : "var(--border)"}`,
                  background: selected ? "rgba(201,97,74,0.1)" : "var(--surface)",
                  color: selected ? "var(--accent1)" : "var(--text-muted)",
                  fontFamily:"'Zen Kaku Gothic New',sans-serif", transition:"all 0.2s",
                }}>
                  {name}
                </button>
              );
            })}
          </div>
          {cbtEmotions.map(e => (
            <div key={e.name} style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"8px", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"10px", padding:"10px 14px" }}>
              <span style={{ fontSize:"12px", minWidth:"56px", color:"var(--text)" }}>{e.name}</span>
              <input type="range" min={0} max={100} value={e.percent}
                onChange={ev => updateCbtEmotionPercent(e.name, parseInt(ev.target.value))}
                style={{ flex:1, accentColor:"var(--accent1)", height:"4px" }} />
              <span style={{ fontSize:"12px", color:"var(--accent1)", minWidth:"36px", textAlign:"right" }}>{e.percent}%</span>
            </div>
          ))}
          <MoodSlider mood={cbtMood} setMood={setCbtMood} />
        </Section>
        <Section num="4" icon="🔍" title="証拠・事実" hint="この考えを支持する根拠は？反証は？" delay="0.18s">
          <textarea value={cbtEvidence} onChange={e => setCbtEvidence(e.target.value)}
            placeholder={"支持：過去にも同じことがあった\n反証：普段は返信してくれる、今日は仕事が忙しいと言っていた"}
            rows={3} style={textareaStyle()} />
        </Section>
        <Section num="5" icon="🌀" title="別の解釈" hint="他にどんな可能性がある？" delay="0.24s">
          <textarea value={cbtAltInterp} onChange={e => setCbtAltInterp(e.target.value)}
            placeholder="例）仕事が忙しかっただけ、スマホが手元になかった…"
            rows={2} style={textareaStyle()} />
        </Section>
        <Section num="6" icon="🎯" title="行動計画" hint="この後どう動く？" delay="0.30s">
          <textarea value={cbtActionPlan} onChange={e => setCbtActionPlan(e.target.value)}
            placeholder="例）30分待ってから確認する、気を紛らわせるために散歩する…"
            rows={2} style={textareaStyle()} />
        </Section>
      </>
    );

    if (mode === "action_log") return (
      <>
        <div style={{ background:"rgba(74,138,102,0.06)", border:"1px solid rgba(74,138,102,0.2)", borderRadius:"12px", padding:"14px 16px", marginBottom:"24px", fontSize:"12px", color:"var(--text-muted)", lineHeight:1.8 }}>
          行動した後の振り返りを記録しましょう。<br />
          「とった行動」と「結果」を蓄積すると行動パターンが見えてきます。
        </div>
        <Section num="1" icon="📍" title="状況" hint="何が起きた？" delay="0s">
          <textarea value={alSituation} onChange={e => setAlSituation(e.target.value)}
            placeholder="例）パートナーから既読スルーされた、喧嘩しそうになった…"
            rows={2} style={textareaStyle()} />
        </Section>
        <Section num="2" icon="💭" title="感情" hint="どう感じた？" delay="0.06s">
          <textarea value={alEmotion} onChange={e => setAlEmotion(e.target.value)}
            placeholder="例）不安50%、焦り30%、悲しみ20%"
            rows={2} style={textareaStyle()} />
          <MoodSlider mood={alMood} setMood={setAlMood} />
        </Section>
        <Section num="3" icon="🎯" title="とった行動" hint="実際に何をした？" delay="0.12s">
          <textarea value={alAction} onChange={e => setAlAction(e.target.value)}
            placeholder="例）30分待ってから連絡した、深呼吸して冷静になった…"
            rows={2} style={textareaStyle()} />
          <label style={{ display:"flex", alignItems:"center", gap:"10px", marginTop:"10px", cursor:"pointer", fontSize:"13px", color:"var(--text)" }}>
            <input type="checkbox" checked={alTenMin} onChange={e => setAlTenMin(e.target.checked)}
              style={{ width:"16px", height:"16px", accentColor:"var(--accent1)", cursor:"pointer" }} />
            <span>⏱ 10分ルールを使った（感情が高ぶったとき10分待った）</span>
          </label>
        </Section>
        <Section num="4" icon="📊" title="結果" hint="どうなった？" delay="0.18s">
          <div style={{ display:"flex", gap:"8px" }}>
            {(["良かった", "微妙", "悪化"] as const).map(opt => (
              <button key={opt} onClick={() => setAlResult(opt)} style={{
                flex:1, padding:"10px 8px", borderRadius:"10px", fontSize:"13px", cursor:"pointer",
                border:`1px solid ${alResult===opt ? (opt==="良かった"?"var(--good)":opt==="悪化"?"var(--danger)":"var(--warn)") : "var(--border)"}`,
                background: alResult===opt ? (opt==="良かった"?"rgba(74,138,102,0.12)":opt==="悪化"?"rgba(184,80,80,0.12)":"rgba(184,120,48,0.12)") : "var(--surface)",
                color: alResult===opt ? (opt==="良かった"?"var(--good)":opt==="悪化"?"var(--danger)":"var(--warn)") : "var(--text-muted)",
                fontFamily:"'Zen Kaku Gothic New',sans-serif", transition:"all 0.2s",
              }}>
                {opt==="良かった"?"✓ 良かった":opt==="悪化"?"↓ 悪化":"△ 微妙"}
              </button>
            ))}
          </div>
        </Section>
        <Section num="5" icon="💡" title="学び" hint="次回に活かすことは？" delay="0.24s">
          <textarea value={alLearning} onChange={e => setAlLearning(e.target.value)}
            placeholder="例）10分待つと冷静になれた、すぐ連絡すると悪化した…"
            rows={2} style={textareaStyle()} />
        </Section>
      </>
    );

    if (mode === "suspicion") return (
      <>
        <div style={{ background:"rgba(201,97,74,0.06)", border:"1px solid rgba(201,97,74,0.2)", borderRadius:"12px", padding:"14px 16px", marginBottom:"24px", fontSize:"12px", color:"var(--text-muted)", lineHeight:1.8 }}>
          不安や疑いが湧いたとき、その場でメモしましょう。<br />1〜2週間続けると自分のパターンが見えてきます。
        </div>
        <Section num="1" icon="📍" title="状況" hint="何が起きた？" delay="0s">
          <textarea value={situation} onChange={e => setSituation(e.target.value)}
            placeholder="例）返信が3時間なかった、笑いながら電話していた…"
            rows={2} style={textareaStyle()} />
        </Section>
        <Section num="2" icon="💓" title="体の反応" hint="体はどう反応した？" delay="0.08s">
          <textarea value={bodyReaction} onChange={e => setBodyReaction(e.target.value)}
            placeholder="例）胸がざわざわした、胃がきゅっとなった…"
            rows={2} style={textareaStyle()} />
          <MoodSlider mood={suspMood} setMood={setSuspMood} />
        </Section>
        <Section num="3" icon="💭" title="頭に浮かんだこと" hint="どんな考えが浮かんだ？" delay="0.16s">
          <textarea value={thought} onChange={e => setThought(e.target.value)}
            placeholder="例）「浮気してるかも」「嫌われたかも」「何か隠してる？」…"
            rows={2} style={textareaStyle()} />
          <ReflectionHint text={thought} />
        </Section>
        <Section num="4" icon="✅" title="実際どうだったか" hint="後から確認できた事実" delay="0.24s">
          <textarea value={actual} onChange={e => setActual(e.target.value)}
            placeholder="例）仕事が忙しかっただけだった、普通に連絡が来た…"
            rows={2} style={textareaStyle()} />
        </Section>
      </>
    );

    return (
      <>
        <div style={{ background:"rgba(77,128,104,0.06)", border:"1px solid rgba(77,128,104,0.2)", borderRadius:"12px", padding:"14px 16px", marginBottom:"24px", fontSize:"12px", color:"var(--text-muted)", lineHeight:1.8 }}>
          「事実」と「解釈」を切り分けて書き出しましょう。<br />他の可能性に気づくだけで、不安の強度が下がります。
        </div>
        <Section num="1" icon="📋" title="事実" hint="目に見えたことだけ" delay="0s">
          <textarea value={fact} onChange={e => setFact(e.target.value)}
            placeholder="例）返信が3時間遅かった"
            rows={2} style={textareaStyle()} />
        </Section>
        <Section num="2" icon="🔮" title="自分の解釈" hint="どう受け取った？" delay="0.08s">
          <textarea value={interpretation} onChange={e => setInterpretation(e.target.value)}
            placeholder="例）嫌われたと思った、何かあったかもと思った…"
            rows={2} style={textareaStyle()} />
          <MoodSlider mood={twoMood} setMood={setTwoMood} />
        </Section>
        <Section num="3" icon="🌀" title="他の可能性" hint="解釈以外の理由を3つ考える" delay="0.16s">
          <div style={{ display:"grid", gap:"8px" }}>
            {alternatives.map((a, i) => (
              <input key={i} value={a}
                onChange={e => setAlternatives(prev => prev.map((v, j) => j===i ? e.target.value : v))}
                placeholder={`可能性${i+1}. 例）仕事が忙しかった、充電が切れてた…`}
                style={inputStyle()} />
            ))}
          </div>
        </Section>
      </>
    );
  }

  return (
    <div style={{ position:"relative", minHeight:"100vh", background:"var(--bg)", color:"var(--text)" }}>
      <div style={{ position:"relative", zIndex:1, maxWidth:"720px", margin:"0 auto", padding:"32px 16px 100px" }}>

        {/* ヘッダー */}
        <header className="animate-fade-down" style={{ textAlign:"center", marginBottom:"40px" }}>
          <p style={{ fontSize:"11px", letterSpacing:"0.4em", color:"var(--text-muted)", marginBottom:"10px", fontFamily:"'Noto Serif JP',serif" }}>
            Mental Health Journal
          </p>
          <h1 style={{
            fontFamily:"'Noto Serif JP',serif", fontSize:"clamp(28px,7vw,40px)", fontWeight:300,
            color:"var(--accent1)", marginBottom:"8px",
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

        {/* モード選択タブ (3+2) */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"8px", marginBottom:"32px" }}>
          {MODE_TABS.map(tab => (
            <button key={tab.mode} onClick={() => setMode(tab.mode)} style={{
              padding:"12px 8px", borderRadius:"12px", cursor:"pointer", textAlign:"center",
              border:`1px solid ${mode===tab.mode ? "var(--accent1)" : "var(--border)"}`,
              background: mode===tab.mode ? "rgba(201,97,74,0.08)" : "var(--surface)",
              color: mode===tab.mode ? "var(--accent1)" : "var(--text-muted)",
              fontFamily:"'Zen Kaku Gothic New',sans-serif", transition:"all 0.2s",
              boxShadow: mode===tab.mode ? "0 1px 4px rgba(43,34,30,0.06)" : "none",
            }}>
              <div style={{ fontSize:"20px", marginBottom:"5px" }}>{tab.icon}</div>
              <div style={{ fontSize:"11px", fontWeight: mode===tab.mode ? 500 : 400, letterSpacing:"0.05em" }}>{tab.label}</div>
              <div style={{ fontSize:"10px", color:"var(--text-muted)", marginTop:"3px", lineHeight:1.4 }}>{tab.desc}</div>
            </button>
          ))}
        </div>

        {/* NGワード警告 */}
        {detectedNg && <NgWordBanner />}

        {/* フォーム */}
        {renderForm()}

        {/* 保存ボタン */}
        <button onClick={saveRecord} disabled={saving} style={{
          width:"100%", padding:"16px",
          background: saving ? "var(--surface2)" : "var(--accent1)",
          border:"none", borderRadius:"12px",
          color: saving ? "var(--text-muted)" : "#fff",
          fontFamily:"'Zen Kaku Gothic New',sans-serif",
          fontSize:"14px", fontWeight:500, letterSpacing:"0.12em",
          cursor: saving ? "not-allowed" : "pointer",
          transition:"all 0.25s", marginBottom:"40px",
          boxShadow: saving ? "none" : "0 2px 8px rgba(201,97,74,0.3)",
        }}>
          {saving ? "保存中…" : "✦ 記録する"}
        </button>

        {/* 記録一覧 */}
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
            <button onClick={async () => {
              if (!confirm("すべての記録を削除しますか？")) return;
              await fetch("/api/records", { method:"DELETE" });
              showToast("🗑 削除しました"); fetchRecords();
            }} style={{ fontSize:"11px", color:"var(--text-muted)", background:"none", border:"none", cursor:"pointer", fontFamily:"'Zen Kaku Gothic New',sans-serif", padding:"4px 8px" }}>
              すべて削除
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign:"center", padding:"40px", color:"var(--text-muted)", fontSize:"13px" }}>読み込み中…</div>
        ) : records.length === 0 ? (
          <div style={{ textAlign:"center", padding:"40px", color:"var(--text-muted)" }}>
            <div style={{ fontSize:"36px", marginBottom:"12px", opacity:0.4 }}>🌿</div>
            <p style={{ fontSize:"13px", fontWeight:300, lineHeight:1.8 }}>まだ記録がありません<br />上のフォームから最初の記録を残してみよう</p>
          </div>
        ) : records.map((r, i) => (
          <RecordCard key={r.id} record={r} index={i} onDelete={async (id) => {
            await fetch(`/api/records?id=${id}`, { method:"DELETE" });
            showToast("🗑 削除しました"); fetchRecords();
          }} />
        ))}
      </div>

      {/* タイマー（固定） */}
      <div style={{ position:"fixed", bottom:"28px", right:"20px", zIndex:99 }}>
        <TimerButton />
      </div>

      {toast && <Toast msg={toast} />}
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

function inputStyle(): React.CSSProperties {
  return {
    width:"100%", background:"var(--surface)", border:"1px solid var(--border)",
    borderRadius:"10px", padding:"11px 14px", color:"var(--text)",
    fontFamily:"'Zen Kaku Gothic New',sans-serif", fontSize:"14px", fontWeight:300,
    outline:"none",
  };
}

function tagBorderColor(cls: string) {
  return cls==="good"?"var(--good)":cls==="danger"?"var(--danger)":cls==="warn"?"var(--warn)":"var(--accent1)";
}

function tagBg(cls: string) {
  return cls==="good"?"rgba(74,138,102,0.12)":cls==="danger"?"rgba(184,80,80,0.12)":cls==="warn"?"rgba(184,120,48,0.12)":"rgba(201,97,74,0.1)";
}

function tagTextColor(cls: string) {
  return cls==="good"?"var(--good)":cls==="danger"?"var(--danger)":cls==="warn"?"var(--warn)":"var(--accent1)";
}
