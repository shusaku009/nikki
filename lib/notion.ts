const API = "https://api.notion.com/v1";

function headers() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
  };
}

const rt = (s: string | null | undefined) =>
  s ? [{ type: "text", text: { content: s.slice(0, 2000) } }] : [];

const ttl = (s: string) => [{ type: "text", text: { content: s.slice(0, 2000) } }];

type ExtraDataMap = Record<string, unknown>;

async function postPage(dbId: string, properties: Record<string, unknown>) {
  const res = await fetch(`${API}/pages`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ parent: { database_id: dbId }, properties }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("[Notion] postPage error:", err);
  }
}

async function patchPage(pageId: string, properties: Record<string, unknown>) {
  await fetch(`${API}/pages/${pageId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ properties }),
  });
}

async function queryDb(dbId: string, filter: unknown) {
  const res = await fetch(`${API}/databases/${dbId}/query`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ filter, page_size: 1 }),
  });
  return res.ok ? res.json() : { results: [] };
}

// ---- DB① 思考ログ ----
async function syncThinkingLog(
  entryType: string,
  event: string | null,
  emotion: string | null,
  mood: number,
  ed: ExtraDataMap,
  today: string
) {
  const dbId = process.env.NOTION_CBT_DB_ID;
  if (!dbId) return;

  const emotionTypes = (ed.emotionTypes as { name: string; percent: number }[] | undefined) ?? [];
  const emotionLevel = emotionTypes[0]?.percent ?? null;

  const props: Record<string, unknown> = {
    "出来事": { title: ttl(event ?? "（未入力）") },
    "モード": { select: { name: entryType } },
    "気分スコア": { number: mood },
    "日付": { date: { start: today } },
  };

  if (ed.autoThought)        props["自動思考"]   = { rich_text: rt(ed.autoThought as string) };
  if (emotionTypes.length)   props["感情タイプ"] = { multi_select: emotionTypes.map(e => ({ name: e.name })) };
  if (emotionLevel !== null) props["感情レベル"] = { number: emotionLevel };
  if (ed.evidence)           props["事実"]       = { rich_text: rt(ed.evidence as string) };
  if (ed.altInterpretation)  props["別の解釈"]   = { rich_text: rt(ed.altInterpretation as string) };
  if (ed.actionPlan)         props["行動計画"]   = { rich_text: rt(ed.actionPlan as string) };
  if (emotion)               props["感情テキスト"] = { rich_text: rt(emotion) };
  if (ed.thought)            props["頭に浮かんだこと"] = { rich_text: rt(ed.thought as string) };
  if (ed.fact)               props["事実（2col）"] = { rich_text: rt(ed.fact as string) };
  if (ed.interpretation)     props["解釈"]       = { rich_text: rt(ed.interpretation as string) };

  await postPage(dbId, props);
}

// ---- DB② 行動ログ ----
async function syncActionLog(
  event: string | null,
  emotion: string | null,
  ed: ExtraDataMap,
  today: string
) {
  const dbId = process.env.NOTION_ACTION_DB_ID;
  if (!dbId) return;

  const props: Record<string, unknown> = {
    "状況": { title: ttl(event ?? "（未入力）") },
    "日付": { date: { start: today } },
  };

  if (emotion)           props["感情"]       = { rich_text: rt(emotion) };
  if (ed.actionTaken)    props["とった行動"] = { rich_text: rt(ed.actionTaken as string) };
  if (typeof ed.tenMinRule === "boolean") props["10分ルール"] = { checkbox: ed.tenMinRule };
  if (ed.resultType)     props["結果"]       = { select: { name: ed.resultType as string } };
  if (ed.learning)       props["学び"]       = { rich_text: rt(ed.learning as string) };

  await postPage(dbId, props);
}

// ---- DB③ 習慣トラッカー（upsert） ----
async function upsertHabitTracker(today: string) {
  const dbId = process.env.NOTION_HABIT_DB_ID;
  if (!dbId) return;

  const data = await queryDb(dbId, {
    property: "日付",
    date: { equals: today },
  });

  if (data.results?.length > 0) {
    await patchPage(data.results[0].id, { "思考ログ書いた": { checkbox: true } });
  } else {
    await postPage(dbId, {
      "タイトル": { title: ttl(today) },
      "日付": { date: { start: today } },
      "思考ログ書いた":        { checkbox: true },
      "10分ルール実行":        { checkbox: false },
      "主体的な発言した":      { checkbox: false },
      "NGワード使わなかった":  { checkbox: false },
      "アウトプットした":      { checkbox: false },
    });
  }
}

// ---- 公開エントリポイント ----
export async function syncToNotion(
  entryType: string,
  event: string | null,
  emotion: string | null,
  mood: number,
  extraData: ExtraDataMap
) {
  if (!process.env.NOTION_API_KEY) return;
  const today = new Date().toISOString().split("T")[0];

  const tasks: Promise<unknown>[] = [upsertHabitTracker(today)];

  if (entryType === "action_log") {
    tasks.push(syncActionLog(event, emotion, extraData, today));
  } else {
    tasks.push(syncThinkingLog(entryType, event, emotion, mood, extraData, today));
  }

  const results = await Promise.allSettled(tasks);
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error(`[Notion] task ${i} failed:`, r.reason);
  });
}
