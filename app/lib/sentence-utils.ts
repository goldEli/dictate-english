"use client";

export type Sentence = {
  id: string;
  text: string;
};

export type Preferences = {
  completionSound: boolean;
  keypressSound: boolean;
};

export const STORAGE_KEY = "dictate-english-sentences";
export const INDEX_STORAGE_KEY = "dictate-english-current-index";
export const PREFERENCES_KEY = "dictate-english-preferences";

export const DEFAULT_SENTENCES: Sentence[] = [
  { id: "s-1", text: "The quick brown fox jumps over the lazy dog." },
  { id: "s-2", text: "Please open the window before the rain starts." },
  { id: "s-3", text: "Travel teaches you what books alone never can." },
];

export const DEFAULT_PREFERENCES: Preferences = {
  completionSound: true,
  keypressSound: true,
};

export const EXPORT_FILENAME = "dictate-english-sentences.json";

export const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

const punctuationRegex = /[\p{P}\p{S}]/gu;

export const stripPunctuation = (value: string) =>
  value.replace(punctuationRegex, "");

export const normalizeForComparison = (value: string) =>
  normalize(stripPunctuation(value).toLowerCase());

export const sanitizeWordForComparison = (value: string) =>
  stripPunctuation(value).toLowerCase();

export const makeId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `s-${Math.random().toString(36).slice(2, 10)}`;
};

export const sanitizeSentencesPayload = (value: unknown): Sentence[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const seenIds = new Set<string>();
  const sanitized: Sentence[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const maybeId = (entry as { id?: unknown }).id;
    const maybeText = (entry as { text?: unknown }).text;

    if (typeof maybeText !== "string") {
      continue;
    }

    let id =
      typeof maybeId === "string" && maybeId.trim().length > 0
        ? maybeId.trim()
        : makeId();

    while (seenIds.has(id)) {
      id = makeId();
    }

    sanitized.push({ id, text: maybeText });
    seenIds.add(id);
  }

  return sanitized;
};

export const sanitizePreferences = (value: unknown): Preferences | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const maybe = value as {
    completionSound?: unknown;
    keypressSound?: unknown;
  };

  const completion =
    typeof maybe.completionSound === "boolean"
      ? maybe.completionSound
      : DEFAULT_PREFERENCES.completionSound;
  const keypress =
    typeof maybe.keypressSound === "boolean"
      ? maybe.keypressSound
      : DEFAULT_PREFERENCES.keypressSound;

  return {
    completionSound: completion,
    keypressSound: keypress,
  };
};
