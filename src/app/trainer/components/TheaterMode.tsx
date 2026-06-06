import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Pen,
  Eraser,
  X,
  MousePointer2,
  Minus,
  Maximize2,
} from "lucide-react";
import type { Deck } from "../data";

type Mode = "navigate" | "laser" | "ink";

const INK_COLORS = [
  { name: "Amber", value: "#ffd86b" },
  { name: "Pink", value: "#ff3366" },
  { name: "Cyan", value: "#42d4ff" },
  { name: "Green", value: "#7be07b" },
  { name: "White", value: "#ffffff" },
];

interface Props {
  deck: Deck;
  version: string;
  onExit: () => void;
}

export function TheaterMode({ deck, version, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [slide, setSlide] = useState(1);
  const [mode, setMode] = useState<Mode>("navigate");
  const [collapsed, setCollapsed] = useState(false);
  const [laser, setLaser] = useState<{ x: number; y: number } | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [inkColor, setInkColor] = useState(INK_COLORS[0].value);

  // Render slide content onto the slide canvas whenever slide or size changes.
  useEffect(() => {
    const c = canvasRef.current;
    const wrap = wrapRef.current;
    if (!c || !wrap) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = wrap.getBoundingClientRect();
      c.width = width * dpr;
      c.height = height * dpr;
      c.style.width = `${width}px`;
      c.style.height = `${height}px`;
      const ctx = c.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#0d2543");
      grad.addColorStop(1, "#1c3a63");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "rgba(255,255,255,0.04)";
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.arc(
          (width / 8) * i + 80,
          height - 60 - (i % 3) * 30,
          120 + (i % 4) * 40,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }

      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "500 14px Inter, system-ui, sans-serif";
      ctx.fillText(`${deck.code}  ·  ${version}`, 64, 64);

      ctx.fillStyle = "white";
      ctx.font = "600 56px Inter, system-ui, sans-serif";
      ctx.fillText(deck.title, 64, 140);

      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "400 22px Inter, system-ui, sans-serif";
      ctx.fillText(`Slide ${slide} of ${deck.slides}`, 64, 180);

      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "500 32px Inter, system-ui, sans-serif";
      const heading = sampleHeadings[(slide - 1) % sampleHeadings.length];
      ctx.fillText(heading, 64, 280);

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "400 20px Inter, system-ui, sans-serif";
      sampleBullets.forEach((b, i) => {
        ctx.fillText(`•  ${b}`, 88, 340 + i * 36);
      });

      // resize ink canvas to match too (preserve nothing on resize for simplicity)
      const ink = inkRef.current;
      if (ink) {
        ink.width = width * dpr;
        ink.height = height * dpr;
        ink.style.width = `${width}px`;
        ink.style.height = `${height}px`;
        const ictx = ink.getContext("2d")!;
        ictx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [slide, deck, version]);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        setSlide((s) => Math.min(deck.slides, s + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setSlide((s) => Math.max(1, s - 1));
      } else if (e.key === "Escape") {
        onExit();
      } else if (e.key.toLowerCase() === "l") {
        setMode((m) => (m === "laser" ? "navigate" : "laser"));
      } else if (e.key.toLowerCase() === "i") {
        setMode((m) => (m === "ink" ? "navigate" : "ink"));
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [deck.slides, onExit]);

  // Pointer handlers on overlay
  const overlayPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (mode === "laser") {
      setLaser({ x, y });
      return;
    }

    if (mode === "ink") {
      const ink = inkRef.current;
      if (!ink) return;
      const ctx = ink.getContext("2d")!;
      if (e.type === "pointerdown") {
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        setDrawing(true);
        ctx.strokeStyle = inkColor;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(x, y);
      } else if (e.type === "pointermove" && drawing) {
        ctx.lineTo(x, y);
        ctx.stroke();
      } else if (e.type === "pointerup" || e.type === "pointercancel") {
        setDrawing(false);
      }
    }
  };

  const clearInk = () => {
    const ink = inkRef.current;
    if (!ink) return;
    const ctx = ink.getContext("2d")!;
    ctx.clearRect(0, 0, ink.width, ink.height);
  };

  useEffect(() => {
    if (mode !== "laser") setLaser(null);
    if (mode !== "ink") setDrawing(false);
  }, [mode]);

  // Clear ink when changing slides
  useEffect(() => {
    clearInk();
  }, [slide]);

  const cursor =
    mode === "laser" ? "none" : mode === "ink" ? "crosshair" : "default";

  return (
    <div className="fixed inset-0 z-50 bg-black select-none">
      <div ref={wrapRef} className="absolute inset-0">
        <canvas ref={canvasRef} className="absolute inset-0" />
        <canvas ref={inkRef} className="absolute inset-0 pointer-events-none" />

        {mode !== "navigate" && (
          <div
            className="absolute inset-0"
            style={{ cursor }}
            onPointerDown={overlayPointer}
            onPointerMove={overlayPointer}
            onPointerUp={overlayPointer}
            onPointerLeave={() => mode === "laser" && setLaser(null)}
          >
            {mode === "laser" && laser && (
              <div
                className="pointer-events-none absolute"
                style={{
                  left: laser.x - 12,
                  top: laser.y - 12,
                  width: 24,
                  height: 24,
                }}
              >
                <div className="absolute inset-0 rounded-full bg-[#ff3366] opacity-90 shadow-[0_0_24px_8px_rgba(255,51,102,0.55)]" />
                <div className="absolute inset-2 rounded-full bg-white opacity-90" />
              </div>
            )}
          </div>
        )}

        {/* Mode badge — top center */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 pointer-events-none">
          <ModeBadge mode={mode} />
        </div>

        {/* Version chip — top right */}
        <div className="absolute top-6 right-6 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-white text-xs tracking-wide">
          {deck.code} · <span className="opacity-80">presenting</span>{" "}
          <span className="text-[#ffd86b]">{version}</span>
        </div>

        {/* Floating command bar — bottom */}
        <CommandBar
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
          mode={mode}
          setMode={setMode}
          slide={slide}
          total={deck.slides}
          onPrev={() => setSlide((s) => Math.max(1, s - 1))}
          onNext={() => setSlide((s) => Math.min(deck.slides, s + 1))}
          onClearInk={clearInk}
          version={version}
          onExit={onExit}
          inkColor={inkColor}
          setInkColor={setInkColor}
        />
      </div>
    </div>
  );
}

function ModeBadge({ mode }: { mode: Mode }) {
  const map = {
    navigate: { label: "Navigate", color: "bg-white/15 text-white border-white/20", Icon: MousePointer2 },
    laser: { label: "Laser Pointer Active", color: "bg-[#ff3366]/20 text-[#ffb3c2] border-[#ff3366]/40", Icon: Crosshair },
    ink: { label: "Live Ink Active", color: "bg-[#ffd86b]/20 text-[#ffd86b] border-[#ffd86b]/40", Icon: Pen },
  } as const;
  const { label, color, Icon } = map[mode];
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md text-[16px] tracking-wide ${color}`}
    >
      <Icon size={13} />
      <span>{label}</span>
    </div>
  );
}

function CommandBar({
  collapsed,
  onToggleCollapsed,
  mode,
  setMode,
  slide,
  total,
  onPrev,
  onNext,
  onClearInk,
  version,
  onExit,
  inkColor,
  setInkColor,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  slide: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onClearInk: () => void;
  version: string;
  onExit: () => void;
  inkColor: string;
  setInkColor: (c: string) => void;
}) {
  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapsed}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 size-10 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/20"
        title="Show command bar"
      >
        <Maximize2 size={14} />
      </button>
    );
  }

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 h-14 px-2 rounded-full bg-black/55 border border-white/15 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
      <ToolBtn
        active={mode === "laser"}
        activeClass="bg-[#ff3366] text-white shadow-[0_0_18px_rgba(255,51,102,0.5)]"
        onClick={() => setMode(mode === "laser" ? "navigate" : "laser")}
        label="Laser (L)"
      >
        <Crosshair size={16} />
      </ToolBtn>
      <InkButton
        mode={mode}
        setMode={setMode}
        inkColor={inkColor}
        setInkColor={setInkColor}
      />
      <ToolBtn
        onClick={onClearInk}
        label="Clear ink"
        disabled={false}
      >
        <Eraser size={16} />
      </ToolBtn>

      <div className="mx-1 h-7 w-px bg-white/15" />

      <ToolBtn onClick={onPrev} label="Previous slide (←)">
        <ChevronLeft size={18} />
      </ToolBtn>
      <div className="px-3 min-w-[88px] text-center text-white text-sm tabular-nums">
        <span className="opacity-90">{slide}</span>
        <span className="opacity-50"> / {total}</span>
      </div>
      <ToolBtn onClick={onNext} label="Next slide (→)">
        <ChevronRight size={18} />
      </ToolBtn>

      <div className="mx-1 h-7 w-px bg-white/15" />

      <div
        className="px-3 h-9 flex items-center rounded-full bg-white/10 text-white/90 text-xs tracking-wide"
        title="Version being presented (read-only)"
      >
        <span className="opacity-60 mr-1.5">Ver</span>
        <span>{version}</span>
      </div>

      <ToolBtn onClick={onToggleCollapsed} label="Hide bar">
        <Minus size={16} />
      </ToolBtn>

      <button
        onClick={onExit}
        className="ml-1 h-9 px-3 rounded-full bg-white/10 text-white text-xs flex items-center gap-1.5 hover:bg-[#d4183d] hover:text-white border border-white/15"
        title="Exit Theater Mode (Esc)"
      >
        <X size={14} /> Exit
      </button>
    </div>
  );
}

function InkButton({
  mode,
  setMode,
  inkColor,
  setInkColor,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  inkColor: string;
  setInkColor: (c: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = mode === "ink";

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => {
          if (active) {
            // Toggle popover when ink already active; first click opens it.
            setOpen((o) => !o);
          } else {
            setMode("ink");
            setOpen(true);
          }
        }}
        title="Live Ink (I)"
        style={active ? { backgroundColor: inkColor } : undefined}
        className={[
          "size-9 rounded-full flex items-center justify-center transition-colors",
          active ? "text-[#0d2543]" : "text-white/85 hover:bg-white/15",
        ].join(" ")}
      >
        <Pen size={16} />
      </button>

      {open && (
        <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-1.5 rounded-full bg-black/80 border border-white/15 backdrop-blur-xl shadow-[0_8px_28px_rgba(0,0,0,0.55)]">
          {INK_COLORS.map((c) => {
            const selected = inkColor === c.value;
            return (
              <button
                key={c.value}
                onClick={() => {
                  setInkColor(c.value);
                  if (mode !== "ink") setMode("ink");
                  setOpen(false);
                }}
                title={c.name}
                className={[
                  "size-5 rounded-full transition-transform",
                  selected
                    ? "ring-2 ring-white ring-offset-1 ring-offset-black/80 scale-110"
                    : "ring-1 ring-white/30 hover:scale-110",
                ].join(" ")}
                style={{ backgroundColor: c.value }}
              />
            );
          })}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 size-2 rotate-45 bg-black/80 border-r border-b border-white/15" />
        </div>
      )}
    </div>
  );
}

function ToolBtn({
  children,
  onClick,
  active,
  activeClass,
  activeStyle,
  label,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  activeClass?: string;
  activeStyle?: React.CSSProperties;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      style={active ? activeStyle : undefined}
      className={[
        "size-9 rounded-full flex items-center justify-center transition-colors",
        active
          ? activeClass ?? "bg-white text-[#0d2543]"
          : "text-white/85 hover:bg-white/15",
        disabled ? "opacity-40 cursor-not-allowed" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

const sampleHeadings = [
  "Mapping the modern threat surface",
  "Risk tiering: critical vs. tolerable",
  "Walking the production floor",
  "Controls hierarchy in practice",
  "Documenting near-miss events",
];

const sampleBullets = [
  "Identify the asset class and its blast radius.",
  "Score likelihood against the OSHA 2026 matrix.",
  "Apply the highest-order control available.",
  "Validate with a peer reviewer before sign-off.",
  "Log the decision trail for audit.",
];

