export type Tag = {
  val: string;
  cls: string;
};

export type EntryType = 'standard' | 'suspicion' | 'two_column' | 'cbt';

export type ExtraData = {
  accomplishments?: string[];
  situation?: string;
  bodyReaction?: string;
  thought?: string;
  actual?: string;
  fact?: string;
  interpretation?: string;
  alternatives?: string[];
  autoThought?: string;
  emotionTypes?: { name: string; percent: number }[];
  evidence?: string;
  altInterpretation?: string;
  actionPlan?: string;
};

export type JournalRecord = {
  id: string;
  user_id: string;
  event: string | null;
  emotion: string | null;
  body_state: string | null;
  mood: number;
  tags: Tag[];
  entry_type: EntryType;
  extra_data: ExtraData;
  created_at: string;
};
