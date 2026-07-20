"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const VIEWBOX_WIDTH = 980;
const VIEWBOX_HEIGHT = 640;

type CascadeNode = {
  id: string;
  name: string;
  category: string;
  hop: number;
  relation_in?: string | null;
};

type CascadeEdge = {
  source: string;
  target: string;
  relation: string;
  satisfies?: string[] | null;
};

type UnlockResponse = {
  root: string;
  root_name: string;
  nodes: CascadeNode[];
  edges: CascadeEdge[];
};

type UnlockCascadeProps = {
  programId: string;
  onClose: () => void;
};

const categoryPalette: Record<string, string> = {
  nutrition: "#34d399",
  health: "#f43f5e",
  cash: "#f59e0b",
  cash_assistance: "#f59e0b",
  tax_credit: "#a78bfa",
  housing: "#60a5fa",
  energy: "#fb923c",
  education: "#2dd4bf",
  telecom: "#94a3b8",
};

const categoryLegendOptions: Array<{ value: string; label: string }> = [
  { value: "nutrition", label: "Nutrition" },
  { value: "health", label: "Health" },
  { value: "cash", label: "Cash" },
  { value: "cash_assistance", label: "Cash assistance" },
  { value: "tax_credit", label: "Tax credits" },
  { value: "housing", label: "Housing" },
  { value: "energy", label: "Energy" },
  { value: "education", label: "Education" },
  { value: "telecom", label: "Telecom" },
];

const edgeLegendOptions = [
  { relation: "categorically_qualifies", label: "Categorically qualifies", color: "#64748b", dash: undefined },
  { relation: "streamlines", label: "Streamlines", color: "#f59e0b", dash: "6 6" },
] as const;

function edgePath(fromNode: { x: number; y: number }, toNode: { x: number; y: number }) {
  const bend = Math.max(20, Math.abs(toNode.x - fromNode.x) * 0.2);
  const c1x = fromNode.x + bend;
  const c1y = fromNode.y;
  const c2x = toNode.x - bend;
  const c2y = toNode.y;
  return `M ${fromNode.x} ${fromNode.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${toNode.x} ${toNode.y}`;
}

function UnlockCascade({ programId, onClose }: UnlockCascadeProps) {
  const [data, setData] = useState<UnlockResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealHop, setRevealHop] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);
    setRevealHop(0);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const loadCascade = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/unlock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ program_id: programId }),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Unable to load unlock cascade");
        }
        const payload = (await response.json()) as UnlockResponse;
        setData(payload);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setError("The unlock cascade could not be loaded.");
      } finally {
        setLoading(false);
      }
    };

    void loadCascade();

    return () => {
      controller.abort();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [programId]);

  const maxHop = useMemo(() => {
    if (!data) {
      return 0;
    }
    return data.nodes.reduce((highest, node) => Math.max(highest, node.hop ?? 0), 0);
  }, [data]);

  useEffect(() => {
    if (!data) {
      return;
    }

    setRevealHop(0);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    intervalRef.current = setInterval(() => {
      setRevealHop((prev) => {
        if (prev >= maxHop) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return prev;
        }
        return prev + 1;
      });
    }, 700);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [data, maxHop]);

  const positions = useMemo(() => {
    if (!data) {
      return new Map<string, { x: number; y: number }>();
    }

    const byHop = new Map<number, CascadeNode[]>();
    data.nodes.forEach((node) => {
      const hop = node.hop ?? 0;
      const group = byHop.get(hop) ?? [];
      group.push(node);
      byHop.set(hop, group);
    });

    const nextPositions = new Map<string, { x: number; y: number }>();
    const horizontalGap = Math.max(200, (VIEWBOX_WIDTH - 180) / Math.max(1, maxHop));

    byHop.forEach((group, hop) => {
      const sorted = [...group].sort((a, b) => a.name.localeCompare(b.name));
      const x = 120 + horizontalGap * hop;
      const step = VIEWBOX_HEIGHT / (sorted.length + 1);

      sorted.forEach((node, index) => {
        nextPositions.set(node.id, {
          x,
          y: step * (index + 1),
        });
      });
    });

    return nextPositions;
  }, [data, maxHop]);

  const visibleNodes = useMemo(() => {
    if (!data) {
      return [] as CascadeNode[];
    }
    return data.nodes.filter((node) => node.hop <= revealHop);
  }, [data, revealHop]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);

  const visibleEdges = useMemo(() => {
    if (!data) {
      return [] as CascadeEdge[];
    }
    return data.edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
  }, [data, visibleNodeIds]);

  return (
    <div className="relative h-full w-full bg-slate-950">
      <div className="absolute inset-x-0 top-0 z-20 border-b border-slate-800 bg-slate-900/85 px-3 py-2 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-200">{data?.root_name ?? "Program"}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Hop {revealHop} / {maxHop}</span>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              Back to graph
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {edgeLegendOptions.map((option) => (
            <div key={option.relation} className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/80 px-2 py-1 text-[8px] font-semibold text-slate-300">
              <svg width="18" height="8" viewBox="0 0 18 8" aria-hidden="true">
                <line x1="1" y1="4" x2="17" y2="4" stroke={option.color} strokeWidth="2" strokeDasharray={option.dash} />
              </svg>
              {option.label}
            </div>
          ))}

          {categoryLegendOptions.map((option) => (
            <div key={option.value} className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/80 px-2 py-1 text-[8px] font-semibold text-slate-300">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: categoryPalette[option.value] ?? "#94a3b8" }} />
              {option.label}
            </div>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading cascade…</div>
      ) : error ? (
        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-rose-300">{error}</div>
      ) : (
        <div className="h-full pt-28 sm:pt-24 lg:pt-20">
          <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
            <defs>
              <marker id="cascade-arrow-solid" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
              </marker>
              <marker id="cascade-arrow-streamline" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
              </marker>
            </defs>

            {visibleEdges.map((edge) => {
              const fromNode = positions.get(edge.source);
              const toNode = positions.get(edge.target);
              if (!fromNode || !toNode) {
                return null;
              }
              const isStreamline = edge.relation === "streamlines";
              const title = isStreamline && edge.satisfies?.length ? edge.satisfies.join(", ") : edge.relation;

              return (
                <path
                  key={`${edge.source}-${edge.target}`}
                  d={edgePath(fromNode, toNode)}
                  stroke={isStreamline ? "#f59e0b" : "#94a3b8"}
                  strokeWidth="1.8"
                  strokeDasharray={isStreamline ? "6 6" : undefined}
                  markerEnd={isStreamline ? "url(#cascade-arrow-streamline)" : "url(#cascade-arrow-solid)"}
                  fill="none"
                  strokeOpacity="0.75"
                >
                  <title>{title}</title>
                </path>
              );
            })}

            {visibleNodes.map((node) => {
              const position = positions.get(node.id);
              if (!position) {
                return null;
              }
              const color = categoryPalette[node.category] ?? "#60a5fa";
              const radius = node.hop === 0 ? 11 : 7;

              return (
                <g key={node.id}>
                  <circle cx={position.x} cy={position.y} r={radius + 6} fill={color} fillOpacity="0.15" />
                  <circle cx={position.x} cy={position.y} r={radius} fill={color} stroke="#0f172a" strokeWidth="1.2" />
                  <title>{node.name}</title>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

export default UnlockCascade;
