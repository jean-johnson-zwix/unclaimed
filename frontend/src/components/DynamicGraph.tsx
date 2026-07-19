"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const MAX_NODES = 16;
const MAX_EDGES = 24;

type GraphNode = { id: string; name: string; category: string; is_hub?: boolean };
type GraphEdge = { source: string; target: string; relation: string; satisfies?: string[] | null };

type GraphResponse = { nodes: GraphNode[]; edges: GraphEdge[] };

type GraphCategory = "all" | "nutrition" | "health" | "cash" | "cash_assistance" | "tax_credit" | "housing" | "energy" | "education" | "telecom";

const categoryPalette: Record<Exclude<GraphCategory, "all">, string> = {
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

const graphCategoryOptions: Array<{ value: GraphCategory; label: string }> = [
  { value: "all", label: "All categories" },
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

function shortenLabel(name: string) {
  const cleaned = name.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 20) {
    return cleaned;
  }

  const words = cleaned.split(" ");
  if (words.length > 1) {
    return `${words.slice(0, 3).join(" ")}…`;
  }

  return `${cleaned.slice(0, 18)}…`;
}

function DynamicGraph() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<GraphCategory>("all");
  const activeRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;
    setLoading(true);
    setError(null);

    const loadGraph = async () => {
      try {
        const params = new URLSearchParams();
        if (selectedCategory !== "all") {
          params.set("category", selectedCategory);
        }

        const query = params.toString();
        const response = await fetch(`${API_BASE_URL}/graph${query ? `?${query}` : ""}`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error("Unable to load the graph");
        }
        const payload = (await response.json()) as GraphResponse;
        setNodes(payload.nodes ?? []);
        setEdges(payload.edges ?? []);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setError("The graph could not be loaded. The backend may be offline.");
      } finally {
        if (activeRequestRef.current === controller) {
          activeRequestRef.current = null;
        }
        setLoading(false);
      }
    };

    void loadGraph();

    return () => {
      controller.abort();
    };
  }, [selectedCategory]);

  const visibleNodes = useMemo(() => nodes.slice(0, MAX_NODES), [nodes]);
  const visibleEdges = useMemo(() => {
    const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
    return edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)).slice(0, MAX_EDGES);
  }, [edges, visibleNodes]);

  const positions = useMemo(() => {
    const nextPositions = new Map<string, { x: number; y: number }>();
    const count = Math.max(1, visibleNodes.length);
    const centerX = 320;
    const centerY = 220;
    const baseRadiusX = 220;
    const baseRadiusY = 180;

    visibleNodes.forEach((node, index) => {
      const angle = (index / count) * Math.PI * 2;
      const radiusX = baseRadiusX + (index % 3) * 24;
      const radiusY = baseRadiusY + (index % 2) * 14;
      nextPositions.set(node.id, {
        x: centerX + Math.cos(angle) * radiusX,
        y: centerY + Math.sin(angle) * radiusY,
      });
    });
    return nextPositions;
  }, [visibleNodes]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      <div className="absolute inset-x-0 top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/80 px-3 py-2 backdrop-blur">
        <label className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.24em] text-slate-300">
          <span>Filter</span>
          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value as GraphCategory)}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-normal uppercase tracking-normal text-slate-200"
          >
            {graphCategoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {graphCategoryOptions
            .filter((option) => option.value !== "all")
            .map((option) => (
              <div key={option.value} className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/80 px-2 py-1 text-[8px] font-medium text-slate-300">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: categoryPalette[option.value as Exclude<GraphCategory, "all">] }} />
                {option.label}
              </div>
            ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading graph…</div>
      ) : error ? (
        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-rose-300">{error}</div>
      ) : visibleNodes.length === 0 ? (
        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-400">No programs match this category.</div>
      ) : (
        <div className="h-full mt-2 pt-16">
          <svg viewBox="0 0 640 480" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
            <rect x="0" y="0" width="640" height="480" fill="transparent" />
            {visibleEdges.map((edge) => {
              const fromNode = positions.get(edge.source);
              const toNode = positions.get(edge.target);
              if (!fromNode || !toNode) return null;
              return (
                <line
                  key={`${edge.source}-${edge.target}`}
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke={edge.relation === "streamlines" ? "#f59e0b" : "#64748b"}
                  strokeWidth="2"
                  strokeDasharray={edge.relation === "streamlines" ? "6 6" : undefined}
                />
              );
            })}
            {visibleNodes.map((node) => {
              const position = positions.get(node.id);
              if (!position) return null;
              const color = categoryPalette[node.category as Exclude<GraphCategory, "all">] ?? "#60a5fa";
              const label = shortenLabel(node.name);
              const labelLines = label.split(/\s+/).reduce<string[]>((acc, word) => {
                const last = acc[acc.length - 1];
                if (!last) {
                  acc.push(word);
                  return acc;
                }

                if (`${last} ${word}`.length <= 14) {
                  acc[acc.length - 1] = `${last} ${word}`;
                } else {
                  acc.push(word);
                }
                return acc;
              }, []);
              const lineHeight = 10;
              const textStartY = position.y + 24;

              return (
                <g key={node.id}>
                  <circle cx={position.x} cy={position.y} r="18" fill={color} fillOpacity="0.22" stroke={node.is_hub ? "#34d399" : undefined} strokeWidth={node.is_hub ? 2 : 0} />
                  <circle cx={position.x} cy={position.y} r="8" fill={node.is_hub ? "#34d399" : color} />
                  <text x={position.x} y={textStartY} textAnchor="middle" fontSize="11" fill="#f8fafc" fontFamily="Arial, sans-serif">
                    {labelLines.map((line, index) => (
                      <tspan key={`${node.id}-${line}-${index}`} x={position.x} dy={index === 0 ? 0 : lineHeight}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

export default DynamicGraph;
