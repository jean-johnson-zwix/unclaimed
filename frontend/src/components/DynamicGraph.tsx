"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const MAX_NODES = 16;
const MAX_EDGES = 24;

type GraphNode = { id: string; name: string; category: string; is_hub?: boolean };
type GraphEdge = { source: string; target: string; relation: string; satisfies?: string[] | null };

type GraphResponse = { nodes: GraphNode[]; edges: GraphEdge[] };

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
  const activeRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;
    setLoading(true);
    setError(null);

    const loadGraph = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/graph`, { signal: controller.signal });
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
  }, []);

  const visibleNodes = useMemo(() => nodes.slice(0, MAX_NODES), [nodes]);
  const visibleEdges = useMemo(() => edges.slice(0, MAX_EDGES), [edges]);

  const positions = useMemo(() => {
    const nextPositions = new Map<string, { x: number; y: number }>();
    const count = Math.max(1, visibleNodes.length);
    const centerX = 320;
    const centerY = 220;
    const baseRadiusX = 220;
    const baseRadiusY = 180;

    visibleNodes.forEach((node, index) => {
      const angle = (index / count) * Math.PI * 2;
      const radiusX = baseRadiusX + (index % 3) * 54;
      const radiusY = baseRadiusY + (index % 2) * 44;
      nextPositions.set(node.id, {
        x: centerX + Math.cos(angle) * radiusX,
        y: centerY + Math.sin(angle) * radiusY,
      });
    });
    return nextPositions;
  }, [visibleNodes]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      {loading ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading graph…</div>
      ) : error ? (
        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-rose-300">{error}</div>
      ) : (
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
            const color = node.is_hub ? "#34d399" : "#60a5fa";
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
                <circle cx={position.x} cy={position.y} r="18" fill={color} fillOpacity="0.22" />
                <circle cx={position.x} cy={position.y} r="8" fill={color} />
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
      )}
    </div>
  );
}

export default DynamicGraph;
