import DynamicGraph from "@/components/DynamicGraph";

const profile = {
  name: "Maya",
  location: "Austin, TX",
  income: "$28,500/year",
  household: "2 adults + 1 child",
  employment: "Full-time warehouse worker",
  status: "Single parent, child under 6",
};

const discoveries = [
  {
    title: "Child Tax Credit",
    amount: "$2,000+",
    match: "95% likely",
    reason:
      "Your earned income and dependent child strongly match the federal credit rules.",
    evidence: ["Child under 17", "Income below threshold", "Tax filing status eligible"],
    action: "File Form 8812 with your annual return.",
  },
  {
    title: "Texas Energy Assistance",
    amount: "Up to $500",
    match: "88% likely",
    reason:
      "Household size and utility burden align with state and utility assistance programs.",
    evidence: ["Low-income household", "Heating/cooling burden", "Local provider participation"],
    action: "Apply through the local utility assistance portal.",
  },
  {
    title: "SNAP / Food Support",
    amount: "$300+",
    match: "91% likely",
    reason:
      "Your income and household size fit the eligibility pattern for food assistance.",
    evidence: ["Gross income under limit", "Dependent child", "Texas enrollment rules"],
    action: "Submit a SNAP application through the state benefits office.",
  },
];

function Header() {
  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          <span className="h-2 w-2 rounded-full bg-slate-600" />
          <span className="h-2 w-2 rounded-full bg-slate-600" />
        </div>

        <div>
          <h1 className="flex items-center gap-1 text-xl font-black tracking-tight text-white">
            UNCLAIMED{" "}
            <span className="rounded bg-emerald-500 px-1.5 py-0.5 font-mono text-xs font-bold tracking-normal text-slate-950">
              AI
            </span>
          </h1>
          <p className="text-xs text-slate-400">Graph-Based Benefit Discovery Engine</p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-850 px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="font-mono text-slate-300">3 Programs Loaded</span>
        </div>
      </div>
    </header>
  );
}

function Dashboard() {
  return (
    <div className="flex min-h-[78vh] w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl shadow-black/20">
      <div className="flex w-full flex-col justify-between border-r border-slate-800 p-4 lg:w-1/2 xl:w-1/2">
        <div className="space-y-4 overflow-y-auto">
          <div className="rounded-xl bg-slate-800 p-4">
            <p className="text-sm font-semibold text-emerald-400">AI Screener</p>
            <p className="mt-1 text-base">
              Welcome! Let’s check your eligibility. How many people live in your home?
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
            <p className="font-semibold text-white">Profile snapshot</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-slate-800/70 px-3 py-2">
                <span>Income</span>
                <span className="font-semibold text-white">{profile.income}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-800/70 px-3 py-2">
                <span>Household</span>
                <span className="font-semibold text-white">{profile.household}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-800/70 px-3 py-2">
                <span>Employment</span>
                <span className="font-semibold text-white">{profile.employment}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-800/70 px-3 py-2">
                <span>Status</span>
                <span className="font-semibold text-white">{profile.status}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">
                Ranked discoveries
              </h3>
              <div className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">
                3 matches
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {discoveries.map((item) => (
                <article key={item.title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-white">{item.title}</h4>
                      <p className="mt-1 text-xs text-slate-300">{item.reason}</p>
                    </div>
                    <div className="text-right">
                      <div className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-300">
                        {item.match}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-white">{item.amount}</div>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.evidence.map((point) => (
                      <span
                        key={point}
                        className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] text-slate-300"
                      >
                        {point}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <input
            className="flex-1 rounded-lg border border-slate-700 bg-slate-850 p-3 text-white placeholder:text-slate-500 focus:outline-none"
            placeholder="Type your answer..."
          />
          <button className="rounded-lg bg-emerald-600 px-5 py-3 font-medium transition-colors hover:bg-emerald-500">
            Send
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-w-[280px] bg-slate-950">
        <div className="absolute left-1/2 top-2 z-10 w-full max-w-[280px] -translate-x-1/2 rounded-lg border border-slate-800 bg-slate-900/80 p-2 text-center backdrop-blur">
          <h2 className="whitespace-nowrap text-[11px] font-bold tracking-tight text-white">
            Live Program Dependency Graph
          </h2>
          <p className="mt-1 text-[9px] leading-3 text-slate-400">Watch nodes unlock as you provide info</p>
        </div>

        <div className="h-full p-1 pt-12">
          <DynamicGraph />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_30%),linear-gradient(135deg,_#07111f_0%,_#0f172a_100%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <Header />
        <Dashboard />
      </div>
    </main>
  );
}
