"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Sentence = {
  id: string;
  text: string;
};

const STORAGE_KEY = "dictate-english-sentences";
const DEFAULT_SENTENCES: Sentence[] = [
  { id: "s-1", text: "The quick brown fox jumps over the lazy dog." },
  { id: "s-2", text: "Please open the window before the rain starts." },
  { id: "s-3", text: "Travel teaches you what books alone never can." },
];

const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

const makeId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `s-${Math.random().toString(36).slice(2, 10)}`;
};

export default function Home() {
  const [sentences, setSentences] = useState<Sentence[]>(DEFAULT_SENTENCES);
  const [isReady, setIsReady] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [draft, setDraft] = useState("");
  const [speechAvailable, setSpeechAvailable] = useState(false);

  const currentSentence = sentences[currentIndex];

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: Sentence[] = JSON.parse(stored);
        if (
          Array.isArray(parsed) &&
          parsed.every(
            (item) =>
              typeof item.id === "string" && typeof item.text === "string",
          )
        ) {
          setSentences(parsed);
        }
      }
    } catch (error) {
      console.error("Unable to read stored sentences", error);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setSpeechAvailable("speechSynthesis" in window);
  }, []);

  useEffect(() => {
    if (!isReady || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sentences));
  }, [isReady, sentences]);

  useEffect(() => {
    setCurrentIndex((previous) => {
      if (sentences.length === 0) {
        return 0;
      }

      if (previous >= sentences.length) {
        return sentences.length - 1;
      }

      return previous;
    });
  }, [sentences.length]);

  const speak = useCallback(
    (text: string) => {
      if (!speechAvailable || typeof window === "undefined" || !text) {
        return;
      }

      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.error("Unable to speak sentence", error);
      }
    },
    [speechAvailable],
  );

  useEffect(() => {
    setInputValue("");
  }, [currentSentence?.id]);

  useEffect(() => {
    if (!currentSentence?.text) {
      return;
    }

    speak(currentSentence.text);
  }, [currentSentence?.text, speak]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        (event.key === "r" || event.key === "R")
      ) {
        event.preventDefault();
        if (currentSentence?.text) {
          speak(currentSentence.text);
        }
      }
    };

    window.addEventListener("keydown", handler);

    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [currentSentence?.text, speak]);

  const handleInputChange = (value: string) => {
    setInputValue(value);

    if (!currentSentence) {
      return;
    }

    const expected = normalize(currentSentence.text);
    const typed = normalize(value);

    if (expected.length > 0 && typed === expected) {
      setInputValue("");
      setCurrentIndex((previous) => {
        if (sentences.length === 0) {
          return 0;
        }

        const nextIndex = previous + 1;
        return nextIndex < sentences.length ? nextIndex : 0;
      });
    }
  };

  const handleAddSentence = () => {
    const cleaned = draft.trim();
    if (!cleaned) {
      return;
    }

    setSentences((previous) => [
      ...previous,
      { id: makeId(), text: cleaned },
    ]);
    setDraft("");
  };

  const handleUpdateSentence = (id: string, text: string) => {
    setSentences((previous) =>
      previous.map((sentence) =>
        sentence.id === id ? { ...sentence, text } : sentence,
      ),
    );
  };

  const handleDeleteSentence = (id: string) => {
    setSentences((previous) =>
      previous.filter((sentence) => sentence.id !== id),
    );
  };

  const { wordStates, mismatch } = useMemo(() => {
    if (!currentSentence) {
      return {
        wordStates: [],
        mismatch: null as null | {
          expected: string;
          typed: string | undefined;
        },
      };
    }

    const targetWords = currentSentence.text.split(/\s+/).filter(Boolean);
    const typedWords = inputValue.trim()
      ? inputValue.trim().split(/\s+/)
      : [];

    let mismatch:
      | {
          expected: string;
          typed: string | undefined;
        }
      | null = null;
    let mismatchFound = false;

    const states = targetWords.map((word, index) => {
      if (mismatchFound) {
        return { word, status: "upcoming" as const };
      }

      const typedWord = typedWords[index];
      if (typedWord === undefined) {
        return { word, status: "upcoming" as const };
      }

      if (typedWord === word) {
        return { word, status: "correct" as const };
      }

      mismatchFound = true;
      mismatch = { expected: word, typed: typedWord };
      return { word, status: "error" as const };
    });

    if (!mismatch && typedWords.length > targetWords.length) {
      mismatch = {
        expected: "",
        typed: typedWords[targetWords.length],
      };
    }

    return { wordStates: states, mismatch };
  }, [currentSentence, inputValue]);

  return (
    <div className="min-h-screen bg-slate-100 py-12 text-slate-900">
      <main className="mx-auto flex w-full max-w-6xl gap-8 px-8">
        <section className="flex-1 rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          <header className="mb-8 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                Dictation
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">
                Listen &amp; Type
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Press Cmd+R (Ctrl+R on Windows) to replay the current sentence.
              </p>
            </div>
            <div className="shrink-0 rounded-full bg-slate-900/5 px-5 py-2 text-xs font-medium text-slate-600">
              {sentences.length > 0 ? (
                <>
                  Sentence {currentIndex + 1} of {sentences.length}
                </>
              ) : (
                "No sentences"
              )}
            </div>
          </header>

          {currentSentence ? (
            <div className="flex flex-col gap-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-slate-700">
                    Speaking:{" "}
                    <span className="font-semibold text-slate-900">
                      {currentSentence.text}
                    </span>
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        currentSentence && speak(currentSentence.text)
                      }
                      className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                    >
                      Replay
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentIndex((previous) => {
                          if (sentences.length === 0) {
                            return 0;
                          }

                          const nextIndex = previous + 1;
                          return nextIndex < sentences.length ? nextIndex : 0;
                        })
                      }
                      className="rounded-full border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400"
                    >
                      Skip
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {wordStates.map(({ word, status }, index) => {
                    const baseStyles =
                      "rounded-full border px-3 py-1 text-sm transition";
                    const styles =
                      status === "correct"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : status === "error"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-transparent bg-white text-slate-600";
                    return (
                      <span
                        key={`${word}-${index}`}
                        className={`${baseStyles} ${styles}`}
                      >
                        {word}
                      </span>
                    );
                  })}
                </div>
                {mismatch && (
                  <p className="mt-4 text-sm text-rose-600">
                    {mismatch.expected
                      ? `Check the word "${mismatch.expected}". You typed "${mismatch.typed ?? ""}".`
                      : `You added an extra word: "${mismatch.typed ?? ""}".`}
                  </p>
                )}
              </div>

              <label className="flex flex-col gap-3">
                <span className="text-sm font-medium text-slate-700">
                  Type what you hear
                </span>
                <textarea
                  value={inputValue}
                  onChange={(event) => handleInputChange(event.target.value)}
                  placeholder="Start typing the sentence..."
                  className="min-h-[140px] resize-none rounded-2xl border border-slate-300 bg-white p-4 text-base text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  autoFocus
                />
              </label>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center text-sm text-slate-500">
              Add a sentence to get started. Sentences are stored locally in your
              browser.
            </div>
          )}
        </section>

        <aside className="w-[320px] shrink-0 space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Sentence Bank
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Create a small library to practice from. Changes save automatically.
            </p>
          </div>

          <div className="space-y-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700">
                Add a sentence
              </span>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Example: She left the keys on the kitchen counter."
                className="min-h-[96px] resize-none rounded-2xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
              <button
                type="button"
                onClick={handleAddSentence}
                className="self-end rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Save
              </button>
            </label>

            <div className="space-y-3">
              {sentences.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No sentences yet. Start by adding one above.
                </p>
              ) : (
                sentences.map((sentence, index) => (
                  <div
                    key={sentence.id}
                    className={`rounded-2xl border px-4 py-3 text-sm shadow-sm transition ${
                      index === currentIndex
                        ? "border-slate-900/60 bg-slate-900/5"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentIndex(index)}
                        className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        Sentence {index + 1}
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => speak(sentence.text)}
                          className="text-xs font-medium text-slate-500 transition hover:text-slate-700"
                        >
                          Play
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSentence(sentence.id)}
                          className="text-xs font-medium text-rose-500 transition hover:text-rose-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={sentence.text}
                      onChange={(event) =>
                        handleUpdateSentence(sentence.id, event.target.value)
                      }
                      className="h-24 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
