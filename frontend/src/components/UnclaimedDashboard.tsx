"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import DynamicGraph from "@/components/DynamicGraph";
import UnclaimedHeader from "@/components/UnclaimedHeader";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const MAX_RESULTS = 5;

type USStateOrTerritory = {
  readonly name: string;
  readonly code: string;
};

const US_STATES_AND_TERRITORIES: readonly USStateOrTerritory[] = [
  // 50 States
  { name: 'Alabama', code: 'AL' },
  { name: 'Alaska', code: 'AK' },
  { name: 'Arizona', code: 'AZ' },
  { name: 'Arkansas', code: 'AR' },
  { name: 'California', code: 'CA' },
  { name: 'Colorado', code: 'CO' },
  { name: 'Connecticut', code: 'CT' },
  { name: 'Delaware', code: 'DE' },
  { name: 'Florida', code: 'FL' },
  { name: 'Georgia', code: 'GA' },
  { name: 'Hawaii', code: 'HI' },
  { name: 'Idaho', code: 'ID' },
  { name: 'Illinois', code: 'IL' },
  { name: 'Indiana', code: 'IN' },
  { name: 'Iowa', code: 'IA' },
  { name: 'Kansas', code: 'KS' },
  { name: 'Kentucky', code: 'KY' },
  { name: 'Louisiana', code: 'LA' },
  { name: 'Maine', code: 'ME' },
  { name: 'Maryland', code: 'MD' },
  { name: 'Massachusetts', code: 'MA' },
  { name: 'Michigan', code: 'MI' },
  { name: 'Minnesota', code: 'MN' },
  { name: 'Mississippi', code: 'MS' },
  { name: 'Missouri', code: 'MO' },
  { name: 'Montana', code: 'MT' },
  { name: 'Nebraska', code: 'NE' },
  { name: 'Nevada', code: 'NV' },
  { name: 'New Hampshire', code: 'NH' },
  { name: 'New Jersey', code: 'NJ' },
  { name: 'New Mexico', code: 'NM' },
  { name: 'New York', code: 'NY' },
  { name: 'North Carolina', code: 'NC' },
  { name: 'North Dakota', code: 'ND' },
  { name: 'Ohio', code: 'OH' },
  { name: 'Oklahoma', code: 'OK' },
  { name: 'Oregon', code: 'OR' },
  { name: 'Pennsylvania', code: 'PA' },
  { name: 'Rhode Island', code: 'RI' },
  { name: 'South Carolina', code: 'SC' },
  { name: 'South Dakota', code: 'SD' },
  { name: 'Tennessee', code: 'TN' },
  { name: 'Texas', code: 'TX' },
  { name: 'Utah', code: 'UT' },
  { name: 'Vermont', code: 'VT' },
  { name: 'Virginia', code: 'VA' },
  { name: 'Washington', code: 'WA' },
  { name: 'West Virginia', code: 'WV' },
  { name: 'Wisconsin', code: 'WI' },
  { name: 'Wyoming', code: 'WY' },
  // Federal District
  { name: 'District of Columbia', code: 'DC' },
  // 5 Major Inhabited Territories
  { name: 'American Samoa', code: 'AS' },
  { name: 'Guam', code: 'GU' },
  { name: 'Northern Mariana Islands', code: 'MP' },
  { name: 'Puerto Rico', code: 'PR' },
  { name: 'U.S. Virgin Islands', code: 'VI' }
] as const;

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
  matched?: Array<{ label?: string; detail?: string; source_url?: string | null }>;
  needs_verification?: Array<{ label?: string; detail?: string; source_url?: string | null }>;
  unlocks?: Array<{ program_id?: string; program_name?: string; relation?: string; hop?: number }>;
  apply_url?: string | null;
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
  explanation?: string;
};

function formatCurrency(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getCategoryAccent(category: string) {
  const palette: Record<string, string> = {
    nutrition: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    health: "border-rose-500/20 bg-rose-500/10 text-rose-300",
    cash: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    cash_assistance: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    tax_credit: "border-violet-500/20 bg-violet-500/10 text-violet-300",
    housing: "border-sky-500/20 bg-sky-500/10 text-sky-300",
    energy: "border-orange-500/20 bg-orange-500/10 text-orange-300",
    education: "border-teal-500/20 bg-teal-500/10 text-teal-300",
    telecom: "border-slate-500/20 bg-slate-500/10 text-slate-300",
  };

  return palette[category] ?? "border-slate-700 bg-slate-800 text-slate-300";
}

function AnimatedAmount({ value, className }: { value: number | null | undefined; className?: string }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value == null || Number.isNaN(value)) {
      setDisplayValue(0);
      return;
    }

    let cancelled = false;
    const startValue = displayValue;
    const endValue = value;
    const durationMs = 900;
    const startTime = window.performance.now();

    const tick = (timestamp: number) => {
      if (cancelled) {
        return;
      }

      const progress = Math.min(1, (timestamp - startTime) / durationMs);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(startValue + (endValue - startValue) * easedProgress);
      setDisplayValue(nextValue);

      if (progress < 1) {
        window.requestAnimationFrame(tick);
      }
    };

    window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
    };
  }, [value]);

  if (value == null || Number.isNaN(value)) {
    return <span className={className}>—</span>;
  }

  return <span className={className}>{formatCurrency(displayValue)}</span>;
}

export default function Dashboard() {
  const [form, setForm] = useState<ProfileFormState>({
    householdSize: "1",
    monthlyIncome: "",
    state: "",
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
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
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

  const groupedVisibleResults = useMemo(() => {
    const likelyEligible = visibleResults.filter((item) => item.verdict === "likely_eligible");
    const uncertain = visibleResults.filter((item) => item.verdict === "uncertain");

    return [
      { key: "likely_eligible", title: "Likely eligible", items: likelyEligible },
      { key: "uncertain", title: "Needs a little more review", items: uncertain },
    ];
  }, [visibleResults]);

  const toggleCard = (programId: string) => {
    setExpandedCards((prev) => ({ ...prev, [programId]: !prev[programId] }));
  };

  return (
    <div className="flex min-h-[78vh] w-full flex-col gap-4">
      <UnclaimedHeader healthStatus={healthStatus} isBackendUp={backendUp} />

      <div className="flex min-h-[78vh] w-full flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl shadow-black/20 lg:flex-row">
        <div className="flex w-full flex-col justify-between border-r border-slate-800 p-4 lg:w-[40%]">
          <div className="space-y-4 overflow-y-auto pr-1">
            <div className="rounded-xl bg-slate-800 p-4">
              <p className="text-sm font-semibold text-emerald-400">AI Screener</p>
              <p className="mt-1 text-base">
                Share the basics and we’ll screen for likely matches. We do not save your data and the form stays in your browser session.
              </p>
              <p className="mt-2 text-sm text-slate-400">This is a preview, not an official determination; verify with each agency before making decisions.</p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="grid gap-3 md:grid-cols-3">
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
                  <label className="space-y-1 text-sm text-slate-300">
                    <span>State</span>
                    <select
                      value={form.state}
                      onChange={(event) => setForm((prev) => ({ ...prev, state: event.target.value }))}
                      className="w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                    >
                      <>
                        <option value="" disabled hidden className="cursor-pointer">Select...</option>
                        {US_STATES_AND_TERRITORIES.map(place => (
                          <option value={place.name} key={place.name} className="cursor-pointer">{place.code}</option>
                        ))}
                      </>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-slate-300 md:col-span-3">
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
                  <label className="space-y-1 text-sm text-slate-300 md:col-span-3">
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
                  <label className="space-y-1 text-sm text-slate-300 md:col-span-3">
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
                  {isSubmitting ? "Checking 61 programs…" : "Submit"}
                </button>
              </div>
            </form>

          </div>
        </div>

        <div className="flex min-w-[280px] flex-col bg-slate-950 lg:w-[60%] p-4">
          <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-950 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-300">Estimated annual value</p>
            <div className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
              {summary?.estimated_total_annual != null ? <AnimatedAmount value={summary.estimated_total_annual} /> : "—"}
            </div>
            <p className="mt-2 text-sm text-slate-300">
              {summary?.estimated_total_annual != null
                ? "This is the combined annual value of the programs most likely to fit your household."
                : "We’ll surface the total once the backend returns a value for the likely-eligible matches."}
            </p>
          </div>

          <div className="flex-shrink-0 border-b border-slate-800 bg-slate-950/95 pt-4 pb-4">
            <div className="relative h-[280px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 sm:h-[340px] lg:h-[620px]">
              <div className="absolute left-1/2 top-2 z-10 w-full max-w-[280px] -translate-x-1/2 rounded-lg p-2 text-center">
                <h2 className="whitespace-nowrap text-[18px] font-bold tracking-tight text-white">Live program graph</h2>
              </div>

              <div className="absolute inset-0 pt-12">
                <DynamicGraph />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 bg-slate-950/95 pt-2">
            {summary ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">Summary</h3>
                <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-300">
                  <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-300">Likely eligible: {summary.likely_eligible ?? 0}</span>
                  <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-300">Needs a check: {summary.uncertain ?? 0}</span>
                </div>
              </div>
            ) : null}

            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
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
                <div className="mt-4 space-y-4">
                  {groupedVisibleResults.map((group) => (
                    <div key={group.key}>
                      {group.items.length > 0 ? (
                        <>
                          <div className="mb-2 flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${group.key === "likely_eligible" ? "bg-emerald-400" : "bg-amber-400"}`} />
                            <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">{group.title}</h4>
                          </div>
                          <div className="space-y-3">
                            {group.items.map((item) => (
                              <article key={item.program_id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className={`h-2.5 w-2.5 rounded-full ${item.verdict === "likely_eligible" ? "bg-emerald-400" : "bg-amber-400"}`} />
                                      <h4 className="text-sm font-semibold text-white">{item.program_name}</h4>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      <span className={`rounded-full border px-2 py-1 text-[11px] font-medium ${getCategoryAccent(item.category)}`}>
                                        {item.category}
                                      </span>
                                      <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${item.verdict === "likely_eligible" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>
                                        {item.verdict.replace(/_/g, " ")}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-right text-sm text-slate-200">
                                    <div className="font-semibold text-white">
                                      {item.estimated_benefit?.estimated_monthly ? `$${item.estimated_benefit.estimated_monthly}/mo` : "Estimate pending"}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-400">
                                      {item.estimated_benefit?.estimated_annual ? `$${item.estimated_benefit.estimated_annual}/yr` : "Annual estimate pending"}
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {(item.unlocks?.length ?? 0) > 0 ? (
                                    <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300">
                                      Unlocks {item.unlocks?.length ?? 0} more →
                                    </span>
                                  ) : null}
                                  {item.apply_url ? (
                                    <a
                                      href={item.apply_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-300"
                                    >
                                      Apply
                                    </a>
                                  ) : null}
                                </div>

                                {(item.matched?.length ?? 0) > 0 ? (
                                  <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-2">
                                    <button
                                      type="button"
                                      onClick={() => toggleCard(item.program_id)}
                                      className="flex w-full items-center justify-between text-left"
                                    >
                                      <span className="text-sm font-semibold text-slate-200">Why you qualify</span>
                                      <span className="text-xs text-slate-400">{expandedCards[item.program_id] ? "Hide" : "Show"}</span>
                                    </button>
                                    {expandedCards[item.program_id] ? (
                                      <ul className="mt-2 space-y-2">
                                        {(item.matched ?? []).map((point, index) => (
                                          <li key={`${item.program_id}-matched-${index}`} className="rounded-lg bg-slate-900/70 p-2">
                                            <div className="text-sm text-white">{point.label ?? point.detail ?? "Condition met"}</div>
                                            {point.detail ? <p className="mt-1 text-xs text-slate-400">{point.detail}</p> : null}
                                            {point.source_url ? (
                                              <a href={point.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-medium text-emerald-300">
                                                View source
                                              </a>
                                            ) : null}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : null}
                                  </div>
                                ) : null}

                                {item.verdict === "uncertain" && (item.needs_verification?.length ?? 0) > 0 ? (
                                  <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2">
                                    <div className="text-sm font-semibold text-amber-200">Almost — do this</div>
                                    <ul className="mt-2 space-y-2">
                                      {(item.needs_verification ?? []).map((point, index) => (
                                        <li key={`${item.program_id}-needs-${index}`} className="text-sm text-amber-100/90">
                                          <div className="font-medium">{point.label ?? "Additional verification"}</div>
                                          {point.detail ? <p className="mt-1 text-xs text-amber-100/80">{point.detail}</p> : null}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}
                              </article>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {disclaimers && Object.keys(disclaimers).length > 0 ? (
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Disclaimers</h4>
                  <ul className="mt-2 space-y-2 text-sm text-slate-400">
                    {Object.entries(disclaimers).map(([key, value]) => (
                      <li key={key}>{value}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
