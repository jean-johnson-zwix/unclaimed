"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const MAX_NODES = 61;
const MAX_EDGES = 100;
const VIEWBOX_WIDTH = 960;
const VIEWBOX_HEIGHT = 640;

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

const edgeLegendOptions = [
  { relation: "categorically_qualifies", label: "Categorically qualifies", color: "#64748b", dash: undefined },
  { relation: "streamlines", label: "Streamlines", color: "#f59e0b", dash: "6 6" },
] as const;

const categoryAnchors: Record<Exclude<GraphCategory, "all">, { x: number; y: number }> = {
  nutrition: { x: 0.2, y: 0.3 },
  health: { x: 0.16, y: 0.62 },
  cash: { x: 0.5, y: 0.74 },
  cash_assistance: { x: 0.58, y: 0.72 },
  tax_credit: { x: 0.76, y: 0.65 },
  housing: { x: 0.36, y: 0.42 },
  energy: { x: 0.74, y: 0.48 },
  education: { x: 0.56, y: 0.3 },
  telecom: { x: 0.83, y: 0.34 },
};

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pseudoRandom(seed: number) {
  const next = Math.imul(seed, 1664525) + 1013904223;
  return [next >>> 0, (next >>> 0) / 4294967295] as const;
}

function buildForceLayout(nodes: GraphNode[], edges: GraphEdge[]) {
  const positions = new Map<string, { x: number; y: number }>();
  const velocity = new Map<string, { vx: number; vy: number }>();
  const masses = new Map<string, number>();

  nodes.forEach((node) => {
    const category = node.category as Exclude<GraphCategory, "all">;
    const anchor = categoryAnchors[category] ?? { x: 0.5, y: 0.5 };
    const baseX = anchor.x * VIEWBOX_WIDTH;
    const baseY = anchor.y * VIEWBOX_HEIGHT;
    let seed = hashString(node.id);
    const randX = pseudoRandom(seed);
    seed = randX[0];
    const randY = pseudoRandom(seed);

    positions.set(node.id, {
      x: baseX + (randX[1] - 0.5) * 180,
      y: baseY + (randY[1] - 0.5) * 130,
    });
    velocity.set(node.id, { vx: 0, vy: 0 });
    masses.set(node.id, node.is_hub ? 1.8 : 1);
  });

  const springLength = 95;
  const springStrength = 0.012;
  const repulsion = 5200;
  const categoryPull = 0.0045;
  const centerPull = 0.002;
  const damping = 0.86;

  for (let step = 0; step < 260; step += 1) {
    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i];
      const posA = positions.get(a.id);
      const velA = velocity.get(a.id);
      if (!posA || !velA) continue;

      let fx = 0;
      let fy = 0;

      for (let j = 0; j < nodes.length; j += 1) {
        if (i === j) continue;
        const b = nodes[j];
        const posB = positions.get(b.id);
        if (!posB) continue;

        const dx = posA.x - posB.x;
        const dy = posA.y - posB.y;
        const distanceSq = Math.max(30, dx * dx + dy * dy);
        const force = repulsion / distanceSq;
        const distance = Math.sqrt(distanceSq);

        fx += (dx / distance) * force;
        fy += (dy / distance) * force;
      }

      const category = a.category as Exclude<GraphCategory, "all">;
      const anchor = categoryAnchors[category] ?? { x: 0.5, y: 0.5 };
      fx += (anchor.x * VIEWBOX_WIDTH - posA.x) * categoryPull;
      fy += (anchor.y * VIEWBOX_HEIGHT - posA.y) * categoryPull;

      fx += (VIEWBOX_WIDTH / 2 - posA.x) * centerPull;
      fy += (VIEWBOX_HEIGHT / 2 - posA.y) * centerPull;

      const mass = masses.get(a.id) ?? 1;
      velA.vx = (velA.vx + fx / mass) * damping;
      velA.vy = (velA.vy + fy / mass) * damping;
    }

    edges.forEach((edge) => {
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      const velSource = velocity.get(edge.source);
      const velTarget = velocity.get(edge.target);
      if (!source || !target || !velSource || !velTarget) return;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const stretch = distance - springLength;
      const pull = stretch * springStrength;
      const nx = dx / distance;
      const ny = dy / distance;

      velSource.vx += nx * pull;
      velSource.vy += ny * pull;
      velTarget.vx -= nx * pull;
      velTarget.vy -= ny * pull;
    });

    nodes.forEach((node) => {
      const pos = positions.get(node.id);
      const vel = velocity.get(node.id);
      if (!pos || !vel) return;

      pos.x = Math.max(28, Math.min(VIEWBOX_WIDTH - 28, pos.x + vel.vx));
      pos.y = Math.max(28, Math.min(VIEWBOX_HEIGHT - 28, pos.y + vel.vy));
    });
  }

  return positions;
}

function edgePath(fromNode: { x: number; y: number }, toNode: { x: number; y: number }, key: string) {
  const dx = toNode.x - fromNode.x;
  const dy = toNode.y - fromNode.y;
  const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const nx = -dy / length;
  const ny = dx / length;
  const bendSeed = hashString(key);
  const bendDirection = bendSeed % 2 === 0 ? 1 : -1;
  const bendAmount = Math.min(48, Math.max(10, length * 0.14)) * bendDirection;
  const cx = fromNode.x + dx * 0.5 + nx * bendAmount;
  const cy = fromNode.y + dy * 0.5 + ny * bendAmount;
  return `M ${fromNode.x} ${fromNode.y} Q ${cx} ${cy} ${toNode.x} ${toNode.y}`;
}

type DynamicGraphProps = {
  allowedProgramIds: string[];
};

function DynamicGraph({ allowedProgramIds }: DynamicGraphProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<GraphCategory>("all");
  const [hoveredNode, setHoveredNode] = useState<{ name: string; x: number; y: number } | null>(null);
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

  const allowedProgramIdSet = useMemo(() => new Set(allowedProgramIds), [allowedProgramIds]);

  const visibleNodes = useMemo(() => {
    if (allowedProgramIdSet.size === 0) {
      return nodes.slice(0, MAX_NODES);
    }

    return nodes.filter((node) => allowedProgramIdSet.has(node.id)).slice(0, MAX_NODES);
  }, [allowedProgramIdSet, nodes]);
  const visibleEdges = useMemo(() => {
    const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
    return edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)).slice(0, MAX_EDGES);
  }, [edges, visibleNodes]);

  const positions = useMemo(() => buildForceLayout(visibleNodes, visibleEdges), [visibleEdges, visibleNodes]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      <div className="absolute inset-x-0 top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/80 px-3 py-2 backdrop-blur">
        <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
          <span>Filter</span>
          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value as GraphCategory)}
            className="cursor-pointer rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-normal uppercase tracking-normal text-slate-200"
          >
            {graphCategoryOptions.map((option) => (
              <option key={option.value} value={option.value} className="cursor-pointer">
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {edgeLegendOptions.map((option) => (
            <div key={option.relation} className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/80 px-2 py-1 text-[8px] font-semibold text-slate-300">
              <svg width="18" height="8" viewBox="0 0 18 8" aria-hidden="true">
                <line x1="1" y1="4" x2="17" y2="4" stroke={option.color} strokeWidth="2" strokeDasharray={option.dash} />
              </svg>
              {option.label}
            </div>
          ))}

          {graphCategoryOptions
            .filter((option) => option.value !== "all")
            .map((option) => (
              <div key={option.value} className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/80 px-2 py-1 text-[8px] font-semibold text-slate-300">
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
        <div className="h-full mt-4 pt-16">
          <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
            <defs>
              <marker id="arrow-solid" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
              </marker>
              <marker id="arrow-streamline" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
              </marker>
            </defs>
            <rect x="0" y="0" width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="transparent" />
            {visibleEdges.map((edge) => {
              const fromNode = positions.get(edge.source);
              const toNode = positions.get(edge.target);
              if (!fromNode || !toNode) return null;
              const isStreamline = edge.relation === "streamlines";
              return (
                <path
                  key={`${edge.source}-${edge.target}`}
                  d={edgePath(fromNode, toNode, `${edge.source}-${edge.target}-${edge.relation}`)}
                  stroke={isStreamline ? "#f59e0b" : "#94a3b8"}
                  strokeWidth="1.4"
                  strokeOpacity="0.6"
                  fill="none"
                  strokeDasharray={isStreamline ? "5 5" : undefined}
                  markerEnd={isStreamline ? "url(#arrow-streamline)" : "url(#arrow-solid)"}
                />
              );
            })}
            {visibleNodes.map((node) => {
              const position = positions.get(node.id);
              if (!position) return null;
              const color = categoryPalette[node.category as Exclude<GraphCategory, "all">] ?? "#60a5fa";
              const radius = node.is_hub ? 10 : 4.6;
              const hubOutline = node.is_hub ? "#0f172a" : "transparent";

              return (
                <g key={node.id}>
                  {node.is_hub ? <circle cx={position.x} cy={position.y} r={radius + 6} fill={color} fillOpacity="0.15" /> : null}
                  <circle
                    cx={position.x}
                    cy={position.y}
                    r={radius}
                    fill={color}
                    stroke={hubOutline}
                    strokeWidth={node.is_hub ? 1.5 : 0}
                    onMouseEnter={() => setHoveredNode({ name: node.name, x: position.x, y: position.y })}
                    onMouseLeave={() => setHoveredNode(null)}
                  />
                </g>
              );
            })}
          </svg>
          {hoveredNode ? (
            <div className="pointer-events-none absolute bottom-3 left-3 z-30 text-xs font-medium text-slate-200">
              {hoveredNode.name}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default DynamicGraph;
