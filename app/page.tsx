"use client";

import Link from "next/link";
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
import {
  DEFAULT_PREFERENCES,
  DEFAULT_SENTENCES,
  EXPORT_FILENAME,
  INDEX_STORAGE_KEY,
  PREFERENCES_KEY,
  Preferences,
  Sentence,
  STORAGE_KEY,
  makeId,
  normalizeForComparison,
  sanitizePreferences,
  sanitizeWordForComparison,
  sanitizeSentencesPayload,
} from "@/app/lib/sentence-utils";

export default function Home() {
  const [sentences, setSentences] = useState<Sentence[]>(DEFAULT_SENTENCES);
  const [isReady, setIsReady] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importStatus, setImportStatus] = useState<
    { type: "success" | "error"; message: string }
    | null>(null);
  const [celebrations, setCelebrations] = useState<string[]>([]);
  const [preferences, setPreferences] =
    useState<Preferences>(DEFAULT_PREFERENCES);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { playCompletion } = useAudioCues({
    keypressEnabled: preferences.keypressSound,
    completionEnabled: preferences.completionSound,
  });
  const triggerCelebration = useCallback(() => {
    setCelebrations((previous) => [...previous, makeId()]);
  }, []);
  const handleCelebrationComplete = useCallback((id: string) => {
    setCelebrations((previous) =>
      previous.filter((value) => value !== id),
    );
  }, []);
  const togglePreference = useCallback((key: keyof Preferences) => {
    setPreferences((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  }, []);
  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);
  const toggleMenu = useCallback(() => {
    setIsMenuOpen((previous) => !previous);
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

    try {
      const storedPreferences = window.localStorage.getItem(PREFERENCES_KEY);
      if (storedPreferences) {
        const parsed = sanitizePreferences(JSON.parse(storedPreferences));
        if (parsed) {
          setPreferences(parsed);
        }
      }
    } catch (error) {
      console.error("Unable to read preferences", error);
    } finally {
      setPreferencesReady(true);
    }
  }, []);

  useEffect(() => {
    if (!preferencesReady || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        PREFERENCES_KEY,
        JSON.stringify(preferences),
      );
    } catch (error) {
      console.error("Unable to store preferences", error);
    }
  }, [preferences, preferencesReady]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setSpeechAvailable("speechSynthesis" in window);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && !menuRef.current.contains(target)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

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

    const expectedNormalized = normalizeForComparison(currentSentence.text);
    const typedNormalized = normalizeForComparison(value);

    if (expectedNormalized.length > 0 && typedNormalized === expectedNormalized) {
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

  const handleMasterSentence = useCallback(() => {
    if (!currentSentence) {
      return;
    }

    setSentences((previous) =>
      previous.filter((sentence) => sentence.id !== currentSentence.id),
    );
    setInputValue("");
  }, [currentSentence, setSentences]);

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
      ? inputValue.trim().split(/\s+/).filter(Boolean)
      : [];

    let mismatch:
      | {
        expected: string;
        typed: string | undefined;
      }
      | null = null;
    let mismatchFound = false;
    let typedIndex = 0;

    const states = targetWords.map((word) => {
      if (mismatchFound) {
        return { word, status: "upcoming" as const };
      }

      const cleanTarget = sanitizeWordForComparison(word);

      if (cleanTarget.length === 0) {
        // Ignore punctuation-only tokens in the sentence definition.
        return { word, status: "correct" as const };
      }

      let typedWord = typedWords[typedIndex];
      let cleanTyped =
        typedWord !== undefined
          ? sanitizeWordForComparison(typedWord)
          : "";

      while (
        typedWord !== undefined &&
        cleanTyped.length === 0
      ) {
        typedIndex += 1;
        typedWord = typedWords[typedIndex];
        cleanTyped =
          typedWord !== undefined
            ? sanitizeWordForComparison(typedWord)
            : "";
      }

      if (typedWord === undefined) {
        return { word, status: "upcoming" as const };
      }

      if (cleanTarget === cleanTyped) {
        typedIndex += 1;
        return { word, status: "correct" as const };
      }

      mismatchFound = true;
      mismatch = { expected: word, typed: typedWord };
      typedIndex += 1;
      return { word, status: "error" as const };
    });

    if (!mismatch) {
      while (typedIndex < typedWords.length) {
        const extraWord = typedWords[typedIndex];
        const cleanExtra = sanitizeWordForComparison(extraWord);

        if (cleanExtra.length > 0) {
          mismatch = {
            expected: "",
            typed: extraWord,
          };
          break;
        }

        typedIndex += 1;
      }
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
            <div className="flex items-center gap-3">
              <div className="shrink-0 rounded-full bg-slate-800 px-5 py-2 text-xs font-medium text-slate-300">
                {sentences.length > 0 ? (
                  <>
                    Sentence {currentIndex + 1} of {sentences.length}
                  </>
                ) : (
                  "No sentences"
                )}
              </div>
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={toggleMenu}
                  aria-expanded={isMenuOpen}
                  aria-haspopup="true"
                  className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-200 transition hover:border-slate-500 hover:text-slate-100"
                >
                  Menu
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={handleImportFile}
                />
                {isMenuOpen && (
                  <div className="absolute right-0 top-full z-[130] mt-3 w-80 space-y-6 rounded-2xl border border-slate-800 bg-slate-950/95 p-6 shadow-2xl shadow-slate-950/50 backdrop-blur">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">
                        Backup &amp; Share
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">
                        Export your practice sentences or import a saved list.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            handleExport();
                            closeMenu();
                          }}
                          className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-900 transition hover:bg-emerald-400"
                        >
                          Export
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            fileInputRef.current?.click();
                            closeMenu();
                          }}
                          className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-slate-500"
                        >
                          Import
                        </button>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">
                        Sound Effects
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">
                        Toggle feedback for typing and completed sentences.
                      </p>
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-slate-100">
                              Key press click
                            </p>
                            <p className="text-xs text-slate-400">
                              Play a soft click for every key you press.
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-pressed={preferences.keypressSound}
                            onClick={() => togglePreference("keypressSound")}
                            className={`min-w-11 relative inline-flex h-6 w-11 items-center rounded-full transition ${preferences.keypressSound
                                ? "bg-emerald-500/80"
                                : "bg-slate-700"
                              }`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-slate-950 transition ${preferences.keypressSound
                                  ? "translate-x-5"
                                  : "translate-x-1"
                                }`}
                            />
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-slate-100">
                              Completion flourish
                            </p>
                            <p className="text-xs text-slate-400">
                              Hear a celebratory chime when you finish a sentence.
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-pressed={preferences.completionSound}
                            onClick={() => togglePreference("completionSound")}
                            className={`min-w-11 relative inline-flex h-6 w-11 items-center rounded-full transition ${preferences.completionSound
                                ? "bg-emerald-500/80"
                                : "bg-slate-700"
                              }`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-slate-950 transition ${preferences.completionSound
                                  ? "translate-x-5"
                                  : "translate-x-1"
                                }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>
          {importStatus && (
            <div
              className={`mb-6 rounded-2xl border px-5 py-3 text-sm ${importStatus.type === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-200"
                }`}
            >
              {importStatus.message}
            </div>
          )}

          {currentSentence ? (
            <div className="flex flex-col gap-6">

              <label className="flex flex-col gap-3">
                <div className="flex items-center gap-4">

                  <span className="text-sm font-medium text-slate-200">
                    Type what you hear
                  </span>

                  <button
                    type="button"
                    onClick={handleMasterSentence}
                    className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 hover:text-emerald-50"
                  >
                    Mastered, No Practice Needed
                  </button>
                </div>
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
              English Lists
            </h2>
            {/* <p className="mt-1 text-sm text-slate-400">
              Jump to any sentence or open the Sentence Bank to manage your
              collection.
            </p> */}
          </div>
          {/* <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
            Find import/export and sound controls in the menu button above.
          </div> */}

          <div className="space-y-4">
            {sentences.length === 0 ? (
              <p className="text-sm text-slate-400">
                No sentences yet. Visit the Sentence Bank to add your first
                practice list.
              </p>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {sentences.map((sentence, index) => {
                  const isActive = index === currentIndex;

                  return (
                    <div
                      key={sentence.id}
                      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition ${isActive
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                          : "border-slate-800 bg-slate-950 text-slate-200 hover:border-slate-600"
                        }`}
                    >
                      <button
                        type="button"
                        onClick={() => setCurrentIndex(index)}
                        className="flex-1 text-left flex flex-nowrap items-center overflow-hidden"
                      >
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {index + 1 < 10 ? `0${index + 1}` : index + 1}
                        </span>
                        <span className="ml-3 inline-block max-w-[14rem] truncate align-middle">
                          {sentence.text}
                        </span>
                      </button>
                      {/* <button
                        type="button"
                        onClick={() => speak(sentence.text)}
                        className="text-xs font-medium text-slate-300 transition hover:text-slate-100"
                      >
                        Play
                      </button> */}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Link
            href="/sentences"
            className="inline-flex w-full items-center justify-center rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-slate-100"
          >
            Open Sentence Bank
          </Link>
        </aside>
      </main>
    </div>
  );
}
