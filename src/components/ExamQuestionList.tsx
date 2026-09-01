import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/Button";

export type QuestionListItem = {
  prompt: string;
  options: string[];
  answerIndex: number;
  marks?: number;
  negativeMarks?: number;
  difficulty?: string;
};

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

export function ExamQuestionList({
  questions,
  onRemove,
  showNegativeMarks = false,
  emptyLabel = "No questions yet.",
}: {
  questions: QuestionListItem[];
  onRemove: (index: number) => void;
  showNegativeMarks?: boolean;
  emptyLabel?: string;
}) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  function toggle(index: number) {
    setExpanded((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  if (questions.length === 0) {
    return <p className="mt-4 text-xs text-zinc-500">{emptyLabel}</p>;
  }

  return (
    <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto">
      {questions.map((q, i) => {
        const open = Boolean(expanded[i]);
        const correctIdx = Math.min(Math.max(q.answerIndex ?? 0, 0), Math.max(q.options.length - 1, 0));

        return (
          <li key={i} className="rounded border border-white/10 bg-white/[0.02]">
            <div className="flex items-start gap-2 p-3">
              <button
                type="button"
                onClick={() => toggle(i)}
                className="mt-0.5 shrink-0 rounded border border-white/10 p-1 text-zinc-400 transition hover:border-accent/30 hover:text-accent"
                aria-expanded={open}
                aria-label={open ? "Collapse question" : "Expand question"}
              >
                {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              <button type="button" onClick={() => toggle(i)} className="min-w-0 flex-1 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Q{i + 1}</span>
                  <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[10px] text-accent">
                    {q.marks ?? 1} mark{(q.marks ?? 1) === 1 ? "" : "s"}
                  </span>
                  {showNegativeMarks && (q.negativeMarks ?? 0) > 0 ? (
                    <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 font-mono text-[10px] text-red-300">
                      −{q.negativeMarks} neg
                    </span>
                  ) : null}
                  {q.difficulty ? (
                    <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] capitalize text-zinc-400">
                      {q.difficulty}
                    </span>
                  ) : null}
                </div>
                <p className={`mt-1 text-sm text-zinc-200 ${open ? "" : "line-clamp-2"}`}>{q.prompt}</p>
              </button>

              <Button type="button" variant="ghost" className="shrink-0 px-2 py-1 text-[10px]" onClick={() => onRemove(i)}>
                Remove
              </Button>
            </div>

            {open ? (
              <div className="border-t border-white/5 px-3 pb-3 pt-2">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Options</p>
                <ul className="space-y-1.5">
                  {q.options.map((opt, optIdx) => {
                    const isCorrect = optIdx === correctIdx;
                    return (
                      <li
                        key={optIdx}
                        className={`flex gap-2 rounded px-2 py-1.5 text-sm ${
                          isCorrect ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-100" : "text-zinc-300"
                        }`}
                      >
                        <span className={`font-mono text-xs ${isCorrect ? "text-emerald-400" : "text-zinc-500"}`}>
                          {OPTION_LABELS[optIdx] ?? optIdx + 1}.
                        </span>
                        <span className="min-w-0 flex-1">{opt}</span>
                        {isCorrect ? (
                          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-400">Correct</span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
