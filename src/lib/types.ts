export interface Word {
  id: string;
  word: string;
  pronunciation: string | null;
  spelling: string | null;
  meaning_english: string | null;
  meaning_hindi: string | null;
  part_of_speech: string | null;
  word_forms: string | null;
  example_sentence: string | null;
  synonyms: string | null;
  antonyms: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type WordInput = Omit<Word, "id" | "created_at" | "updated_at">;
