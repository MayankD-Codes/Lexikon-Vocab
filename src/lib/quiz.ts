import type { Word } from "@/lib/types";

export type QuestionType = "meaning_recall" | "sentence_completion" | "synonym_antonym";

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  word: Word;
  prompt: string;
  hint?: string;
  options: string[];
  correctAnswer: string;
}

export interface WordStat {
  word_id: string;
  correct_count: number;
  incorrect_count: number;
  last_tested_at: string | null;
  difficulty_score: number;
}

export interface AnswerRecord {
  word_id: string;
  question_type: QuestionType;
  correct_answer: string;
  user_answer: string;
  is_correct: boolean;
  response_time_ms: number;
}

export const QUIZ_SIZE = 7;
export const MIN_WORDS_REQUIRED = 10;

const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const pick = <T>(arr: T[]): T | undefined => arr[Math.floor(Math.random() * arr.length)];

const splitList = (s: string | null | undefined): string[] =>
  (s ?? "")
    .split(/[,;|\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);

/** Categorize a word into weak / learning / strong based on its stats. */
const categorize = (stat: WordStat | undefined): "weak" | "learning" | "strong" => {
  if (!stat || stat.correct_count + stat.incorrect_count === 0) return "learning";
  const total = stat.correct_count + stat.incorrect_count;
  const accuracy = stat.correct_count / total;
  if (accuracy < 0.5 || stat.incorrect_count >= 2) return "weak";
  if (accuracy >= 0.8 && total >= 3) return "strong";
  return "learning";
};

/** Pick QUIZ_SIZE words using 50% weak / 30% learning / 20% strong buckets. */
export const selectQuizWords = (words: Word[], stats: WordStat[]): Word[] => {
  const statsByWord = new Map(stats.map((s) => [s.word_id, s]));
  const weak: Word[] = [];
  const learning: Word[] = [];
  const strong: Word[] = [];

  for (const w of words) {
    const bucket = categorize(statsByWord.get(w.id));
    if (bucket === "weak") weak.push(w);
    else if (bucket === "learning") learning.push(w);
    else strong.push(w);
  }

  const targets = {
    weak: Math.round(QUIZ_SIZE * 0.5),
    learning: Math.round(QUIZ_SIZE * 0.3),
    strong: QUIZ_SIZE - Math.round(QUIZ_SIZE * 0.5) - Math.round(QUIZ_SIZE * 0.3),
  };

  const take = (pool: Word[], n: number): Word[] => shuffle(pool).slice(0, n);

  let chosen = [
    ...take(weak, targets.weak),
    ...take(learning, targets.learning),
    ...take(strong, targets.strong),
  ];

  // Backfill from any remaining words if buckets were short
  if (chosen.length < QUIZ_SIZE) {
    const chosenIds = new Set(chosen.map((w) => w.id));
    const remaining = shuffle(words.filter((w) => !chosenIds.has(w.id)));
    chosen = [...chosen, ...remaining.slice(0, QUIZ_SIZE - chosen.length)];
  }

  return shuffle(chosen).slice(0, QUIZ_SIZE);
};

/** Decide which question types are valid for a given word. */
const eligibleTypes = (word: Word): QuestionType[] => {
  const types: QuestionType[] = [];
  if (word.meaning_english) types.push("meaning_recall");
  if (word.example_sentence && word.example_sentence.toLowerCase().includes(word.word.toLowerCase()))
    types.push("sentence_completion");
  if (splitList(word.synonyms).length || splitList(word.antonyms).length)
    types.push("synonym_antonym");
  return types;
};

const buildMeaningRecall = (word: Word, allWords: Word[]): QuizQuestion | null => {
  if (!word.meaning_english) return null;
  const distractors = shuffle(
    allWords.filter((w) => w.id !== word.id && w.meaning_english).map((w) => w.meaning_english!)
  ).slice(0, 3);
  if (distractors.length < 3) return null;
  const options = shuffle([word.meaning_english, ...distractors]);
  return {
    id: `${word.id}-mr`,
    type: "meaning_recall",
    word,
    prompt: `What does “${word.word}” mean?`,
    options,
    correctAnswer: word.meaning_english,
  };
};

const buildSentenceCompletion = (word: Word, allWords: Word[]): QuizQuestion | null => {
  if (!word.example_sentence) return null;
  const re = new RegExp(`\\b${word.word}\\b`, "i");
  if (!re.test(word.example_sentence)) return null;
  const blanked = word.example_sentence.replace(re, "__________");
  const distractors = shuffle(allWords.filter((w) => w.id !== word.id).map((w) => w.word)).slice(0, 3);
  if (distractors.length < 3) return null;
  const options = shuffle([word.word, ...distractors]);
  return {
    id: `${word.id}-sc`,
    type: "sentence_completion",
    word,
    prompt: "Fill in the blank:",
    hint: blanked,
    options,
    correctAnswer: word.word,
  };
};

const buildSynonymAntonym = (word: Word, allWords: Word[]): QuizQuestion | null => {
  const syns = splitList(word.synonyms);
  const ants = splitList(word.antonyms);
  const useSynonym = syns.length > 0 && (ants.length === 0 || Math.random() < 0.5);
  const correct = useSynonym ? pick(syns)! : pick(ants)!;
  if (!correct) return null;

  const otherWordsPool = allWords
    .filter((w) => w.id !== word.id)
    .flatMap((w) => [w.word, ...splitList(w.synonyms), ...splitList(w.antonyms)]);
  const banned = new Set([
    word.word.toLowerCase(),
    ...syns.map((s) => s.toLowerCase()),
    ...ants.map((a) => a.toLowerCase()),
  ]);
  const distractors = shuffle(
    Array.from(new Set(otherWordsPool.filter((x) => !banned.has(x.toLowerCase()))))
  ).slice(0, 3);
  if (distractors.length < 3) return null;

  const options = shuffle([correct, ...distractors]);
  return {
    id: `${word.id}-sa`,
    type: "synonym_antonym",
    word,
    prompt: useSynonym
      ? `Choose a synonym of “${word.word}”.`
      : `Choose an antonym of “${word.word}”.`,
    options,
    correctAnswer: correct,
  };
};

/** Build one question per chosen word, rotating across question types where possible. */
export const buildQuestions = (chosenWords: Word[], allWords: Word[]): QuizQuestion[] => {
  const builders: Record<QuestionType, (w: Word, all: Word[]) => QuizQuestion | null> = {
    meaning_recall: buildMeaningRecall,
    sentence_completion: buildSentenceCompletion,
    synonym_antonym: buildSynonymAntonym,
  };
  const order: QuestionType[] = ["meaning_recall", "sentence_completion", "synonym_antonym"];
  const questions: QuizQuestion[] = [];
  let cursor = 0;

  for (const word of chosenWords) {
    const eligible = eligibleTypes(word);
    if (eligible.length === 0) continue;
    // Try preferred type from rotation first, then fall back
    const preferred = order[cursor % order.length];
    const tryOrder = [preferred, ...order.filter((t) => t !== preferred)].filter((t) =>
      eligible.includes(t)
    );
    let q: QuizQuestion | null = null;
    for (const t of tryOrder) {
      q = builders[t](word, allWords);
      if (q) break;
    }
    if (q) {
      questions.push(q);
      cursor++;
    }
  }
  return questions;
};

export const todayISO = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
