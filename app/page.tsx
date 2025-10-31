"use client";

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ConfettiBurst } from "@/app/components/confetti";
import { useAudioCues } from "@/app/hooks/use-audio-cues";

type Sentence = {
  id: string;
  text: string;
};

const STORAGE_KEY = "dictate-english-sentences";
const INDEX_STORAGE_KEY = "dictate-english-current-index";
const DEFAULT_SENTENCES: Sentence[] = [
  { id: "s-1", text: "The quick brown fox jumps over the lazy dog." },
  { id: "s-2", text: "Please open the window before the rain starts." },
  { id: "s-3", text: "Travel teaches you what books alone never can." },
];
const EXPORT_FILENAME = "dictate-english-sentences.json";

const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

const makeId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `s-${Math.random().toString(36).slice(2, 10)}`;
};

const sanitizeSentencesPayload = (value: unknown): Sentence[] | null => {
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

export default function Home() {
  const [sentences, setSentences] = useState<Sentence[]>(DEFAULT_SENTENCES);
  const [isReady, setIsReady] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [draft, setDraft] = useState("");
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importStatus, setImportStatus] = useState<
    { type: "success" | "error"; message: string }
    | null>(null);
  const [celebrations, setCelebrations] = useState<string[]>([]);
  const { playCompletion } = useAudioCues();
  const triggerCelebration = useCallback(() => {
    setCelebrations((previous) => [...previous, makeId()]);
  }, []);
  const handleCelebrationComplete = useCallback((id: string) => {
    setCelebrations((previous) =>
      previous.filter((value) => value !== id),
    );
  }, []);

  const currentSentence = sentences[currentIndex];

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const storedSentences = window.localStorage.getItem(STORAGE_KEY);
      let restoredSentences: Sentence[] | null = null;

      if (storedSentences) {
        const parsed = sanitizeSentencesPayload(JSON.parse(storedSentences));
        if (parsed) {
          restoredSentences = parsed;
          setSentences(parsed);
        }
      }

      const storedIndex = window.localStorage.getItem(INDEX_STORAGE_KEY);
      if (storedIndex !== null) {
        const parsedIndex = Number.parseInt(storedIndex, 10);

        if (!Number.isNaN(parsedIndex)) {
          const referenceList = restoredSentences ?? DEFAULT_SENTENCES;
          if (referenceList.length === 0) {
            setCurrentIndex(0);
          } else {
            const safeIndex = Math.min(
              Math.max(parsedIndex, 0),
              referenceList.length - 1,
            );
            setCurrentIndex(safeIndex);
          }
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
    if (!isReady || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(INDEX_STORAGE_KEY, `${currentIndex}`);
    } catch (error) {
      console.error("Unable to store current sentence index", error);
    }
  }, [currentIndex, isReady]);

  useEffect(() => {
    if (!importStatus || typeof window === "undefined") {
      return;
    }

    const timer = window.setTimeout(() => {
      setImportStatus(null);
    }, 5000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [importStatus, setImportStatus]);

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
      playCompletion();
      triggerCelebration();
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

  const handleExport = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const payload = sentences.map((sentence) => ({
        id: sentence.id,
        text: sentence.text,
      }));

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = window.URL.createObjectURL(blob);
      const tempLink = document.createElement("a");
      tempLink.href = url;
      tempLink.download = EXPORT_FILENAME;
      document.body.appendChild(tempLink);
      tempLink.click();
      tempLink.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Unable to export sentences", error);
    }
  }, [sentences]);

  const handleImportFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (event.target.value) {
        event.target.value = "";
      }

      if (!file) {
        return;
      }

      setImportStatus(null);

      try {
        const text = await file.text();
        const raw = JSON.parse(text);
        const parsed = sanitizeSentencesPayload(raw);

        if (!parsed) {
          throw new Error("Invalid payload");
        }

        if (Array.isArray(raw) && raw.length > 0 && parsed.length === 0) {
          throw new Error("No valid sentences");
        }

        setSentences(parsed);
        setCurrentIndex(0);
        setInputValue("");
        setImportStatus({
          type: "success",
          message: `Imported ${parsed.length} sentence${parsed.length === 1 ? "" : "s"
            } successfully.`,
        });
      } catch (error) {
        console.error("Unable to import sentences", error);
        setImportStatus({
          type: "error",
          message:
            "Import failed. Please choose a JSON file exported from this app.",
        });
      }
    },
    [setCurrentIndex, setImportStatus, setInputValue, setSentences],
  );

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
    <div className="min-h-screen bg-slate-950 py-12 text-slate-100">
      {celebrations.map((id) => (
        <ConfettiBurst
          key={id}
          seed={id}
          onDone={() => handleCelebrationComplete(id)}
        />
      ))}
      <main className="mx-auto flex w-full max-w-6xl gap-8 px-8">
        <section className="flex-1 rounded-3xl border border-slate-800 bg-slate-900 p-10 shadow-lg shadow-slate-950/40">
          <header className="mb-8 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                Dictation
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-100">
                Listen &amp; Type
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Press Cmd+R (Ctrl+R on Windows) to replay the current sentence.
              </p>
            </div>
            <div className="shrink-0 rounded-full bg-slate-800 px-5 py-2 text-xs font-medium text-slate-300">
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

              <label className="flex flex-col gap-3">
                <span className="text-sm font-medium text-slate-200">
                  Type what you hear
                </span>
                <textarea
                  value={inputValue}
                  onChange={(event) => handleInputChange(event.target.value)}
                  placeholder="Start typing the sentence..."
                  className="min-h-[140px] resize-none rounded-2xl border border-slate-700 bg-slate-950 p-4 text-base text-slate-100 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-700"
                  autoFocus
                />
              </label>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-slate-200">
                    Speaking:{" "}
                    <span className="font-semibold text-slate-100">
                      {currentSentence.text}
                    </span>
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        currentSentence && speak(currentSentence.text)
                      }
                      className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-medium text-slate-900 transition hover:bg-emerald-400"
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
                      className="rounded-full border border-slate-700 px-5 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500"
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
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                        : status === "error"
                          ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                          : "border-slate-700 bg-slate-800 text-slate-300";
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
                  <p className="mt-4 text-sm text-rose-400">
                    {mismatch.expected
                      ? `Check the word "${mismatch.expected}". You typed "${mismatch.typed ?? ""}".`
                      : `You added an extra word: "${mismatch.typed ?? ""}".`}
                  </p>
                )}
              </div>

            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 p-12 text-center text-sm text-slate-400">
              Add a sentence to get started. Sentences are stored locally in your
              browser.
            </div>
          )}
        </section>

        <aside className="w-[320px] shrink-0 space-y-6 rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-lg shadow-slate-950/40">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Sentence Bank
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Create a small library to practice from. Changes save automatically.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Backup &amp; Share
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Export your sentences or import a saved list in one click.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExport}
                className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-emerald-400"
              >
                Export
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500"
              >
                Import
              </button>
            </div>
            {importStatus && (
              <p
                className={`mt-3 text-sm ${importStatus.type === "success"
                    ? "text-emerald-400"
                    : "text-rose-400"
                  }`}
              >
                {importStatus.message}
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImportFile}
            />
          </div>

          <div className="space-y-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-200">
                Add a sentence
              </span>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Example: She left the keys on the kitchen counter."
                className="min-h-[96px] resize-none rounded-2xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-700"
              />
              <button
                type="button"
                onClick={handleAddSentence}
                className="self-end rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-emerald-400"
              >
                Save
              </button>
            </label>

            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {sentences.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No sentences yet. Start by adding one above.
                </p>
              ) : (
                sentences.map((sentence, index) => (
                  <div
                    key={sentence.id}
                    className={`rounded-2xl border px-4 py-3 text-sm shadow-sm transition ${index === currentIndex
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : "border-slate-800 bg-slate-950"
                      }`}
                    onClick={() => setCurrentIndex(index)}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentIndex(index)}
                        className="text-xs font-semibold uppercase tracking-wide text-slate-400"
                      >
                        Sentence {index + 1}
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => speak(sentence.text)}
                          className="text-xs font-medium text-slate-300 transition hover:text-slate-100"
                        >
                          Play
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSentence(sentence.id)}
                          className="text-xs font-medium text-rose-400 transition hover:text-rose-300"
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
                      onFocus={() => setCurrentIndex(index)}
                      className="h-24 w-full resize-none rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-100 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-700"
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
