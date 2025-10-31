"use client";

import Link from "next/link";
import {
  ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  DEFAULT_SENTENCES,
  EXPORT_FILENAME,
  INDEX_STORAGE_KEY,
  Sentence,
  STORAGE_KEY,
  makeId,
  sanitizeSentencesPayload,
} from "@/app/lib/sentence-utils";

type ImportStatus =
  | { type: "success"; message: string }
  | { type: "error"; message: string };

export default function SentenceBankPage() {
  const [sentences, setSentences] = useState<Sentence[]>(DEFAULT_SENTENCES);
  const [draft, setDraft] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const storedSentences = window.localStorage.getItem(STORAGE_KEY);
      if (storedSentences) {
        const parsed = sanitizeSentencesPayload(JSON.parse(storedSentences));
        if (parsed) {
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
    if (!isReady || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sentences));
  }, [isReady, sentences]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setSpeechAvailable("speechSynthesis" in window);
  }, []);

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
  }, [importStatus]);

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
    setSentences((previous) => previous.filter((sentence) => sentence.id !== id));
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
        window.localStorage.setItem(INDEX_STORAGE_KEY, "0");
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
    [],
  );

  return (
    <div className="min-h-screen bg-slate-950 py-12 text-slate-100">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
              Sentence Bank
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-100">
              Manage Your Practice Lists
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Add, edit, import, or export the sentences you use on the practice
              screen.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-slate-700 px-5 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-slate-100"
          >
            Back to Practice
          </Link>
        </header>

        {importStatus && (
          <div
            className={`rounded-2xl border px-5 py-3 text-sm ${
              importStatus.type === "success"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : "border-rose-500/40 bg-rose-500/10 text-rose-200"
            }`}
          >
            {importStatus.message}
          </div>
        )}

        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                Backup &amp; Share
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Export a JSON snapshot or import a list you previously saved.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
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
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImportFile}
          />
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold text-slate-100">
            Add a sentence
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Draft a new practice sentence. It will appear at the end of the list.
          </p>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Example: She left the keys on the kitchen counter."
            className="mt-4 min-h-[96px] w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-700"
          />
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleAddSentence}
              className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-emerald-400"
            >
              Save sentence
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-100">
              Library
            </h2>
            <p className="text-sm text-slate-400">
              {sentences.length} sentence{sentences.length === 1 ? "" : "s"}
            </p>
          </div>
          {sentences.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              Nothing here yet. Add a sentence above or import one of your saved
              lists.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {sentences.map((sentence, index) => (
                <div
                  key={sentence.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-sm shadow-slate-950/30"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Sentence {index + 1}
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => speak(sentence.text)}
                        className="font-medium text-slate-300 transition hover:text-slate-100"
                      >
                        Play
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSentence(sentence.id)}
                        className="font-medium text-rose-400 transition hover:text-rose-300"
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
                    className="h-24 w-full resize-none rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-100 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-700"
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
