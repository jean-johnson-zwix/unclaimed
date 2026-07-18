"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import DynamicGraph from "@/components/DynamicGraph";
import UnclaimedHeader from "@/components/UnclaimedHeader";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const MAX_RESULTS = 8;

const categoryOptions = [
  { id: "pregnant", label: "Pregnant" },
  { id: "postpartum", label: "Recently gave birth" },
  { id: "infant", label: "Have an infant" },
  { id: "has_child_under_5", label: "Have a child under 5" },
  { id: "has_child", label: "Have a school-age child" },
  { id: "senior_65plus", label: "Age 65 or older" },
  { id: "disabled", label: "Have a disability" },
  { id: "blind", label: "Blind" },
  { id: "veteran", label: "Veteran" },
  { id: "student", label: "Enrolled student" },
  { id: "homeless", label: "Experiencing homelessness" },
  { id: "foster_child", label: "Foster child in household" },
];

const enrolledOptions = [
  { id: "snap", label: "SNAP / Nutrition Assistance" },
  { id: "tanf", label: "Cash Assistance (TANF)" },
  { id: "ssi", label: "SSI" },
  { id: "medicaid", label: "AHCCCS / Medicaid" },
  { id: "wic", label: "WIC" },
  { id: "lifeline", label: "Lifeline" },
  { id: "liheap", label: "LIHEAP" },
  { id: "section_8", label: "Section 8" },
];

type ProfileFormState = {
  householdSize: string;
  monthlyIncome: string;
  state: string;
  age: string;
  categories: string[];
  enrolledIn: string[];
  assets: string;
  immigrationStatus: string;
};

type HealthStatus = {
  status: string;
  programs_loaded: number | null;
  fpl_year: number | null;
};

type ResultItem = {
  program_id: string;
  program_name: string;
  verdict: string;
  category: string;
  estimated_benefit?: { estimated_monthly?: number; estimated_annual?: number; note?: string } | null;
  matched?: Array<{ label?: string; detail?: string }>;
  needs_verification?: Array<{ label?: string; detail?: string }>;
  unlocks?: Array<{ program_id?: string }>;
};

type ScreenResponse = {
  resolved_profile?: Record<string, unknown>;
  results?: ResultItem[];
  summary?: {
    likely_eligible?: number;
    uncertain?: number;
    programs_checked?: number;
    estimated_total_annual?: number | null;
  };
  disclaimers?: Record<string, string>;
  meta?: Record<string, unknown>;
};

export default function Dashboard() {
  const [form, setForm] = useState<ProfileFormState>({
    householdSize: "1",
    monthlyIncome: "",
    state: "AZ",
    age: "",
    categories: [],
    enrolledIn: [],
    assets: "",
    immigrationStatus: "",
  });
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({ status: "checking", programs_loaded: null, fpl_year: null });
  const [backendUp, setBackendUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [summary, setSummary] = useState<ScreenResponse["summary"] | null>(null);
  const [disclaimers, setDisclaimers] = useState<Record<string, string> | null>(null);
  const [resolvedProfile, setResolvedProfile] = useState<Record<string, unknown> | null>(null);
  const activeRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const loadHealth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error("Health check failed");
        }
        const payload = (await response.json()) as HealthStatus;
        if (!cancelled) {
          setHealthStatus(payload);
          setBackendUp(true);
        }
      } catch (err) {
        if (!cancelled && err instanceof Error && err.name !== "AbortError") {
          setBackendUp(false);
          setHealthStatus({ status: "unavailable", programs_loaded: null, fpl_year: null });
          setError("The backend is unavailable. Start the FastAPI server on port 8000 to continue.");
        }
      }
    };

    void loadHealth();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const handleCheckboxChange = (field: "categories" | "enrolledIn", value: string) => {
    setForm((prev) => {
      const current = prev[field];
      const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
      return { ...prev, [field]: next };
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const householdSize = Number(form.householdSize);
    const monthlyIncome = Number(form.monthlyIncome);
    const age = form.age ? Number(form.age) : null;

    if (!Number.isInteger(householdSize) || householdSize < 1) {
      setError("Household size must be a whole number of at least 1.");
      return;
    }
    if (!Number.isFinite(monthlyIncome) || monthlyIncome < 0) {
      setError("Monthly income must be a valid number of 0 or more.");
      return;
    }
    if (age !== null && (!Number.isFinite(age) || age < 0 || age > 120)) {
      setError("Age must be between 0 and 120 if provided.");
      return;
    }

    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;
    setIsSubmitting(true);
    setError(null);

    const payload = {
      profile: {
        household_size: householdSize,
        monthly_income: monthlyIncome,
        state: form.state || "AZ",
        age: age ?? null,
        categories: form.categories,
        enrolled_in: form.enrolledIn,
        assets: form.assets ? Number(form.assets) : null,
        immigration_status: form.immigrationStatus || null,
      },
      mode: "pipeline",
    };

    try {
      const response = await fetch(`${API_BASE_URL}/screen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = (await response.json().catch(() => null)) as ScreenResponse & { error?: { message?: string } };

      if (!response.ok) {
        const message = data?.error?.message || "The request could not be completed.";
        throw new Error(message);
      }

      setResults(data.results ?? []);
      setSummary(data.summary ?? null);
      setDisclaimers(data.disclaimers ?? null);
      setResolvedProfile(data.resolved_profile ?? null);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Unable to complete the screening request.");
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
      }
      setIsSubmitting(false);
    }
  };

  const [resultPage, setResultPage] = useState(1);

  useEffect(() => {
    setResultPage(1);
  }, [results.length]);

  const totalPages = Math.max(1, Math.ceil(results.length / MAX_RESULTS));
  const visibleResults = useMemo(() => {
    const startIndex = (resultPage - 1) * MAX_RESULTS;
    return results.slice(startIndex, startIndex + MAX_RESULTS);
  }, [resultPage, results]);

  return (
    <div className="flex min-h-[78vh] w-full flex-col gap-4">
      <UnclaimedHeader healthStatus={healthStatus} isBackendUp={backendUp} />
      <div className="flex min-h-[78vh] w-full flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl shadow-black/20 lg:flex-row">
        <div className="flex w-full flex-col justify-between border-r border-slate-800 p-4 lg:w-[55%]">
          <div className="space-y-4 overflow-y-auto pr-1">
            <div className="rounded-xl bg-slate-800 p-4">
              <p className="text-sm font-semibold text-emerald-400">AI Screener</p>
              <p className="mt-1 text-base">
                Share the basics and we’ll screen for likely matches. We do not save your data and the form stays in your browser session.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-sm text-slate-300">
                    <span>Household size</span>
                    <input
                      type="number"
                      min="1"
                      value={form.householdSize}
                      onChange={(event) => setForm((prev) => ({ ...prev, householdSize: event.target.value }))}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-300">
                    <span>Monthly income (gross, USD/mo)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.monthlyIncome}
                      onChange={(event) => setForm((prev) => ({ ...prev, monthlyIncome: event.target.value }))}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                      placeholder="Enter dollar amount"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-300">
                    <span>State</span>
                    <select
                      value={form.state}
                      onChange={(event) => setForm((prev) => ({ ...prev, state: event.target.value }))}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                    >
                      <option value="AZ">AZ</option>
                      <option value="CA">CA</option>
                      <option value="TX">TX</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-slate-300">
                    <span>Age</span>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={form.age}
                      onChange={(event) => setForm((prev) => ({ ...prev, age: event.target.value }))}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-300 md:col-span-2">
                    <span>Assets (optional, USD)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.assets}
                      onChange={(event) => setForm((prev) => ({ ...prev, assets: event.target.value }))}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                      placeholder="Enter dollar amount"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-300 md:col-span-2">
                    <span>Immigration status (optional)</span>
                    <input
                      value={form.immigrationStatus}
                      onChange={(event) => setForm((prev) => ({ ...prev, immigrationStatus: event.target.value }))}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                      placeholder="Leave blank if you prefer not to answer"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">Household status</h3>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {categoryOptions.map((option) => (
                    <label key={option.id} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={form.categories.includes(option.id)}
                        onChange={() => handleCheckboxChange("categories", option.id)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">Currently receiving</h3>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {enrolledOptions.map((option) => (
                    <label key={option.id} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={form.enrolledIn.includes(option.id)}
                        onChange={() => handleCheckboxChange("enrolledIn", option.id)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              {error ? (
                <div className="rounded-lg border border-rose-700/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>
              ) : null}

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-emerald-600 px-5 py-3 font-medium transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-600"
                >
                  {isSubmitting ? "Screening..." : "Submit"}
                </button>
              </div>
            </form>

            {summary ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">Summary</h3>
                <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-300">
                  <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-300">Likely eligible: {summary.likely_eligible ?? 0}</span>
                  <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-300">Uncertain: {summary.uncertain ?? 0}</span>
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">Results</h3>
                <div className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">
                  {results.length > 0 ? `${Math.min(results.length, MAX_RESULTS)} of ${results.length}` : "No results yet"}
                </div>
              </div>

              {results.length > MAX_RESULTS ? (
                <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-300">
                  <button
                    type="button"
                    onClick={() => setResultPage((page) => Math.max(1, page - 1))}
                    disabled={resultPage === 1}
                    className="rounded-md border border-slate-700 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span>Page {resultPage} of {totalPages}</span>
                  <button
                    type="button"
                    onClick={() => setResultPage((page) => Math.min(totalPages, page + 1))}
                    disabled={resultPage === totalPages}
                    className="rounded-md border border-slate-700 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              ) : null}

              {visibleResults.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">Submit the form to see ranked programs from the backend.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {visibleResults.map((item) => (
                    <article key={item.program_id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-semibold text-white">{item.program_name}</h4>
                          <p className="mt-1 text-xs text-slate-300">{item.category}</p>
                        </div>
                        <div className="text-right">
                          <div className={`rounded-full px-2 py-1 text-[11px] font-semibold ${item.verdict === "likely_eligible" ? "bg-emerald-500/10 text-emerald-300" : item.verdict === "uncertain" ? "bg-amber-500/10 text-amber-300" : "bg-slate-800 text-slate-300"}`}>
                            {item.verdict}
                          </div>
                          <div className="mt-1 text-xs font-semibold text-white">
                            {item.estimated_benefit?.estimated_monthly ? `$${item.estimated_benefit.estimated_monthly}/mo` : "Estimate pending"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {(item.matched ?? []).slice(0, 3).map((point, index) => (
                          <span key={`${item.program_id}-matched-${index}`} className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] text-slate-300">
                            {point.label ?? point.detail ?? "Matched condition"}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="relative flex-1 min-w-[280px] bg-slate-950">
          <div className="absolute left-1/2 top-2 z-10 w-full max-w-[280px] -translate-x-1/2 rounded-lg border border-slate-800 bg-slate-900/80 p-2 text-center backdrop-blur">
            <h2 className="whitespace-nowrap text-[11px] font-bold tracking-tight text-white">Live program graph</h2>
            <p className="mt-1 text-[9px] leading-3 text-slate-400">The graph is refreshed from the backend response.</p>
          </div>

          <div className="h-full p-1 pt-12">
            <DynamicGraph />
          </div>
        </div>
      </div>
    </div>
  );
}
