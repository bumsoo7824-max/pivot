"use client";

import { useMemo, useState } from "react";
import { mappingRows, type MappingRow } from "@/data/mapping";
import { jobPostings, jobsNote } from "@/data/jobs";

const confidenceStyle: Record<MappingRow["confidence"], string> = {
  최상: "bg-emerald-50 text-emerald-700 border-emerald-200",
  상: "bg-brand-50 text-brand-700 border-brand-200",
  중: "bg-amber-50 text-amber-700 border-amber-200",
  낮음: "bg-slate-100 text-slate-600 border-slate-300",
};

// distinct categories (first occurrence keeps the primary mapping row)
const categories = Array.from(
  new Map(mappingRows.map((r) => [r.category, r])).keys()
);

export default function MatchDemo() {
  const [selected, setSelected] = useState<string | null>(categories[0]);

  const rowsForSelected = useMemo(
    () => mappingRows.filter((r) => r.category === selected),
    [selected]
  );
  const primaryRow = rowsForSelected[0];

  const matchedJobs = useMemo(() => {
    if (!primaryRow) return [];
    const ids = new Set(rowsForSelected.map((r) => r.id));
    return jobPostings.filter((j) => ids.has(j.mappingId));
  }, [rowsForSelected, primaryRow]);

  return (
    <div className="space-y-10">
      {/* Step 1: category picker */}
      <section>
        <StepLabel n={1} label="재북 직업 선택" />
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((cat) => {
            const active = cat === selected;
            return (
              <button
                key={cat}
                onClick={() => setSelected(cat)}
                className={`rounded-lg border px-3.5 py-3 text-left text-sm font-medium transition ${
                  active
                    ? "border-brand-600 bg-brand-600 text-white shadow-md shadow-brand-600/20"
                    : "border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </section>

      {/* Flow visualization */}
      {primaryRow && (
        <FlowStrip category={primaryRow.category} ncsField={primaryRow.ncsField} jobCount={matchedJobs.length} />
      )}

      {/* Step 2: NCS mapping result(s) */}
      {primaryRow && (
        <section>
          <StepLabel n={2} label="NCS 매핑 결과" />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {rowsForSelected.map((row) => (
              <MappingCard key={row.id} row={row} />
            ))}
          </div>
        </section>
      )}

      {/* Step 3: job postings */}
      <section>
        <StepLabel n={3} label="연결된 채용공고" />
        <p className="mt-1 text-xs text-slate-400">* {jobsNote}</p>
        {matchedJobs.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500">
            현재 선택된 직업과 연결된 예시 채용공고가 없습니다. 다른 직업을
            선택해보세요.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {matchedJobs.map((job) => (
              <article
                key={job.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-bold text-slate-900">
                    {job.title}
                  </h4>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    {job.employmentType}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{job.company}</p>
                <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-xs text-slate-600">
                  <Field label="근무지역" value={job.region} />
                  <Field label="급여" value={job.salary} />
                  <Field label="경력" value={job.career} />
                  <Field label="최소학력" value={job.minEducation} />
                </dl>
                <p className="mt-3 rounded-md bg-brand-50 px-3 py-2 text-xs leading-relaxed text-brand-800">
                  <strong className="font-semibold">우대조건</strong> ·{" "}
                  {job.preferred}
                </p>
                <p className="mt-2 text-[11px] text-slate-400">
                  매칭 NCS 직무: {job.matchedNcs} · 공고번호 {job.id} · 마감{" "}
                  {job.closesAt}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StepLabel({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
        {n}
      </span>
      <h2 className="text-base font-bold text-slate-900 sm:text-lg">
        {label}
      </h2>
    </div>
  );
}

function FlowStrip({
  category,
  ncsField,
  jobCount,
}: {
  category: string;
  ncsField: string;
  jobCount: number;
}) {
  const nodes = [
    { title: "재북 직업", value: category },
    { title: "NCS 매핑", value: ncsField },
    { title: "채용공고", value: `${jobCount}건 연결` },
  ];
  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4 sm:p-5">
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        {nodes.map((node, i) => (
          <div key={node.title} className="flex flex-1 items-center gap-2">
            <div className="flex-1 rounded-lg border border-brand-200 bg-white px-4 py-2.5 text-center shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-500">
                {node.title}
              </p>
              <p className="mt-0.5 truncate text-sm font-bold text-slate-900">
                {node.value}
              </p>
            </div>
            {i < nodes.length - 1 && (
              <span className="hidden shrink-0 text-lg text-brand-400 sm:block">
                →
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MappingCard({ row }: { row: MappingRow }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-400">
            {row.ncsGroup}
          </p>
          <h3 className="mt-0.5 text-base font-bold text-slate-900">
            {row.ncsField}
          </h3>
          <p className="text-sm text-slate-500">{row.kecoJob}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
            confidenceStyle[row.confidence]
          }`}
        >
          신뢰도 {row.confidence}
        </span>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        {row.description}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {row.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
          >
            #{tag}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3.5 py-2.5">
        <span className="text-xs font-medium text-slate-500">
          2025 참고 취업률 (KECO 직종 기준)
        </span>
        <span className="text-lg font-extrabold text-brand-700">
          {row.employmentRate2025}%
        </span>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-700">{value}</dd>
    </div>
  );
}
