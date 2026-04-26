import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function headers() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

async function checkDb(dbId: string | undefined, label: string) {
  if (!dbId) return { label, status: "env未設定" };

  const res = await fetch(`${NOTION_API}/databases/${dbId}`, {
    headers: headers(),
  });
  const data = await res.json();

  if (!res.ok) {
    return { label, status: "エラー", dbId, error: data };
  }

  return {
    label,
    status: "接続OK",
    dbId,
    properties: Object.entries(data.properties as Record<string, { type: string }>).map(
      ([name, prop]) => ({ name, type: prop.type })
    ),
  };
}

async function testPost(dbId: string | undefined) {
  if (!dbId) return { status: "env未設定" };

  const res = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      parent: { database_id: dbId },
      properties: {
        "状況": { title: [{ type: "text", text: { content: "【テスト投稿】削除してください" } }] },
        "日付": { date: { start: new Date().toISOString().split("T")[0] } },
      },
    }),
  });
  const data = await res.json();

  if (!res.ok) return { status: "投稿エラー", error: data };
  return { status: "投稿成功", pageId: data.id };
}

export async function GET() {
  // 認証チェック（ログイン済みユーザーのみ）
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "NOTION_API_KEY が未設定です" });
  }

  const [cbt, action, habit] = await Promise.all([
    checkDb(process.env.NOTION_CBT_DB_ID, "DB① 思考ログ"),
    checkDb(process.env.NOTION_ACTION_DB_ID, "DB② 行動ログ"),
    checkDb(process.env.NOTION_HABIT_DB_ID, "DB③ 習慣トラッカー"),
  ]);

  // DB②に実際にテスト投稿してみる
  const postTest = await testPost(process.env.NOTION_ACTION_DB_ID);

  return NextResponse.json({
    apiKey: `${apiKey.slice(0, 10)}...（設定済み）`,
    databases: { cbt, action, habit },
    postTest,
  });
}
