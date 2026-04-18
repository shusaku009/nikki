export type Tag = {
  val: string;
  cls: string;
};

export type JournalRecord = {
  id: string;
  user_id: string;
  event: string | null;
  emotion: string | null;
  body_state: string | null;
  mood: number;
  tags: Tag[];
  created_at: string;
};
