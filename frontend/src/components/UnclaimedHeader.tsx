type HeaderHealthStatus = {
  status: string;
  programs_loaded: number | null;
  fpl_year: number | null;
};

export default function UnclaimedHeader({
  healthStatus,
  isBackendUp,
}: {
  healthStatus: HeaderHealthStatus;
  isBackendUp: boolean;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-slate-800 bg-slate-900 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
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
          <p className="text-xs text-slate-400">Graph-based benefit discovery</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${isBackendUp ? "border-emerald-700/60 bg-emerald-500/10 text-emerald-300" : "border-rose-700/60 bg-rose-500/10 text-rose-300"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${isBackendUp ? "bg-emerald-400" : "bg-rose-400"}`} />
          <span className="font-mono">{isBackendUp ? "Backend online" : "Backend offline"}</span>
        </div>
        <div className="rounded-full border border-slate-700 bg-slate-850 px-3 py-1.5 text-slate-300">
          {healthStatus.programs_loaded != null ? `${healthStatus.programs_loaded} programs loaded` : "Checking backend..."}
        </div>
      </div>
    </header>
  );
}
