export type Tag = {
  val: string;
  cls: string;
};

export type EntryType = 'standard' | 'suspicion' | 'two_column' | 'cbt' | 'action_log';

export type ExtraData = {
  // standard
  accomplishments?: string[];
  // suspicion
  situation?: string;
  bodyReaction?: string;
  thought?: string;
  actual?: string;
  // two_column
  fact?: string;
  interpretation?: string;
  alternatives?: string[];
  // cbt
  autoThought?: string;
  emotionTypes?: { name: string; percent: number }[];
  evidence?: string;
  altInterpretation?: string;
  actionPlan?: string;
  // action_log
  actionTaken?: string;
  tenMinRule?: boolean;
  resultType?: string;
  learning?: string;
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
