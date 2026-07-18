"use client";

const nodes = [
  { id: "income", label: "Income", x: 120, y: 180, color: "#34d399" },
  { id: "household", label: "Household", x: 300, y: 110, color: "#60a5fa" },
  { id: "location", label: "Location", x: 480, y: 180, color: "#f59e0b" },
  { id: "program", label: "Program Match", x: 320, y: 320, color: "#a78bfa" },
];

const links = [
  ["income", "program"],
  ["household", "program"],
  ["location", "program"],
  ["income", "household"],
];

export default function DynamicGraph() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-b-3xl bg-slate-950">
      <svg viewBox="0 0 600 420" className="h-full w-full">
        <rect x="0" y="0" width="600" height="420" fill="transparent" />
        {links.map(([from, to]) => {
          const fromNode = nodes.find((node) => node.id === from);
          const toNode = nodes.find((node) => node.id === to);
          if (!fromNode || !toNode) return null;

          return (
            <line
              key={`${from}-${to}`}
              x1={fromNode.x}
              y1={fromNode.y}
              x2={toNode.x}
              y2={toNode.y}
              stroke="#334155"
              strokeWidth="2"
              strokeDasharray="6 6"
            />
          );
        })}
        {nodes.map((node) => (
          <g key={node.id}>
            <circle cx={node.x} cy={node.y} r="28" fill={node.color} fillOpacity="0.22" />
            <circle cx={node.x} cy={node.y} r="16" fill={node.color} />
            <text
              x={node.x}
              y={node.y + 42}
              textAnchor="middle"
              fontSize="12"
              fill="#f8fafc"
              fontFamily="Arial, sans-serif"
            >
              {node.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
