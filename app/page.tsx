"use client";

import "chart.js/auto";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Bar, Doughnut, Line } from "react-chartjs-2";

/* ─────────────────────────── Types ─────────────────────────── */
type PnlEntry = {
  id: string;
  userId: string;
  date: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
};

type HeatLevel = "zero" | "pos1" | "pos2" | "pos3" | "neg1" | "neg2" | "neg3";

/* ─────────────────────────── Formatters ────────────────────── */
const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(v);

function fmtCompact(v: number): string {
  const abs = Math.abs(v);
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  // if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  // if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

/* ─────────────────────────── Date helpers ──────────────────── */
function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoToKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function todayKey(): string {
  return localDateKey(new Date());
}

function monthKeyOf(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function prevMonth(mk: string): string {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(mk: string): string {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(mk: string): string {
  const [y, m] = mk.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function dayLabel(dk: string): string {
  const [y, m, d] = dk.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildCells(
  mk: string,
): Array<{ key: string | null; day: number | null; isToday: boolean }> {
  const [y, m] = mk.split("-").map(Number);
  const today = todayKey();
  const offset = new Date(y, m - 1, 1).getDay();
  const days = new Date(y, m, 0).getDate();
  const cells: Array<{
    key: string | null;
    day: number | null;
    isToday: boolean;
  }> = [];
  for (let i = 0; i < offset; i++)
    cells.push({ key: null, day: null, isToday: false });
  for (let d = 1; d <= days; d++) {
    const k = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ key: k, day: d, isToday: k === today });
  }
  while (cells.length % 7 !== 0)
    cells.push({ key: null, day: null, isToday: false });
  return cells;
}

function heatLevel(v: number, maxAbs: number): HeatLevel {
  if (v === 0 || maxAbs <= 0) return "zero";
  const r = Math.abs(v) / maxAbs;
  if (v > 0) return r > 0.66 ? "pos3" : r > 0.33 ? "pos2" : "pos1";
  return r > 0.66 ? "neg3" : r > 0.33 ? "neg2" : "neg1";
}

const HEAT: Record<HeatLevel, string> = {
  zero: "heat-zero",
  pos1: "heat-pos-1",
  pos2: "heat-pos-2",
  pos3: "heat-pos-3",
  neg1: "heat-neg-1",
  neg2: "heat-neg-2",
  neg3: "heat-neg-3",
};

// เลือกสีตัวเลขวันให้ contrast ดีบนทุก heat level
function cellDayCls(level: HeatLevel, isToday: boolean): string {
  const bright = level !== "zero";
  if (isToday)
    return bright
      ? "text-white font-bold drop-shadow-sm"
      : "text-emerald-400 font-bold";
  return bright ? "text-white font-medium" : "text-slate-500";
}

// เลือกสีตัวเลข amount ให้ contrast ดีบนทุก heat level
function cellAmtCls(level: HeatLevel, positive: boolean): string {
  if (level === "pos3" || level === "neg3")
    return "text-white font-black drop-shadow-sm";
  if (level === "pos2" || level === "neg2")
    return "text-white/95 font-bold drop-shadow-sm";
  if (level === "pos1" || level === "neg1") return "text-white/90 font-bold";
  return positive ? "text-emerald-400" : "text-rose-400";
}

function pnlCls(v: number) {
  return v > 0 ? "pnl-pos" : v < 0 ? "pnl-neg" : "pnl-zero";
}

/* ─────────────────────────── Chart options ─────────────────── */
const TOOLTIP = {
  backgroundColor: "#0c0f1a",
  borderColor: "rgba(16,185,129,0.22)",
  borderWidth: 1,
  titleColor: "#475569",
  bodyColor: "#e2e8f0",
  padding: 10,
  cornerRadius: 8,
  displayColors: false,
};

const AXIS_STYLE = {
  ticks: { color: "#2d4050", font: { size: 10 } as const },
  grid: { color: "rgba(255,255,255,0.03)" },
  border: { display: false },
};

/* ══════════════════════════ Dashboard ══════════════════════════ */
export default function DashboardPage() {
  const router = useRouter();
  const formRef = useRef<HTMLDivElement>(null);
  const firstLoad = useRef(true);

  const [entries, setEntries] = useState<PnlEntry[]>([]);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notification, setNotification] = useState<{
    type: "ok" | "err";
    msg: string;
  } | null>(null);
  const [selDate, setSelDate] = useState(todayKey());
  const [formAmt, setFormAmt] = useState("");
  const [calView, setCalView] = useState<"month" | "year">("month");
  const [calMonth, setCalMonth] = useState(monthKeyOf());
  const [calYear, setCalYear] = useState(String(new Date().getFullYear()));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(monthKeyOf());
  const pickerRef = useRef<HTMLDivElement>(null);

  /* ── Load ── */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sr, er] = await Promise.all([
        fetch("/api/auth/session", { cache: "no-store" }),
        fetch("/api/pnl", { cache: "no-store" }),
      ]);
      if (!sr.ok) {
        router.replace("/auth");
        return;
      }
      const s = (await sr.json()) as { user: { username: string } };
      setUsername(s.user.username);
      if (!er.ok) throw new Error("Failed to load entries.");
      const data = (await er.json()) as PnlEntry[];
      setEntries(data);
      if (firstLoad.current) {
        firstLoad.current = false;
        const todayEntry = data.find((e) => isoToKey(e.date) === todayKey());
        if (todayEntry) setFormAmt(todayEntry.amount.toString());
      }
    } catch {
      setNotification({ type: "err", msg: "Failed to load data." });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    }
    if (showDatePicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDatePicker]);

  /* ── Derived maps ── */
  const entryMap = useMemo(() => {
    const map = new Map<string, { id: string; amount: number }>();
    for (const e of entries)
      map.set(isoToKey(e.date), { id: e.id, amount: e.amount });
    return map;
  }, [entries]);

  /* ── Totals ── */
  const totals = useMemo(() => {
    const today = todayKey();
    const thisMonth = monthKeyOf();
    const thisYear = today.slice(0, 4);
    let overall = 0,
      todayPnl = 0,
      monthPnl = 0;
    let wins = 0,
      losses = 0,
      flat = 0;
    const monthly = new Map<string, number>();
    const keys: string[] = [];

    for (const [k, v] of entryMap) {
      overall += v.amount;
      if (k === today) todayPnl = v.amount;
      if (k.startsWith(thisMonth)) monthPnl += v.amount;
      if (v.amount > 0) wins++;
      else if (v.amount < 0) losses++;
      else flat++;
      const mk = k.slice(0, 7);
      monthly.set(mk, (monthly.get(mk) ?? 0) + v.amount);
      if (!k.startsWith(thisYear)) keys.push(k);
      else keys.push(k);
    }
    keys.sort();

    let run = 0;
    const cumulative: number[] = [];
    const lineLabels: string[] = [];
    for (const k of keys) {
      run += entryMap.get(k)!.amount;
      cumulative.push(Number(run.toFixed(2)));
      lineLabels.push(k);
    }

    const monthKeys = [...monthly.keys()].sort();
    const monthData = monthKeys.map((k) =>
      Number((monthly.get(k) ?? 0).toFixed(2)),
    );
    const total = wins + losses + flat;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

    return {
      overall,
      todayPnl,
      monthPnl,
      wins,
      losses,
      flat,
      winRate,
      total,
      monthly,
      cumulative,
      lineLabels,
      monthKeys,
      monthData,
    };
  }, [entryMap]);

  /* ── Calendar cells ── */
  const calCells = useMemo(() => {
    const cells = buildCells(calMonth);
    let maxAbs = 0;
    for (const c of cells) {
      if (!c.key) continue;
      const a = entryMap.get(c.key)?.amount ?? 0;
      if (Math.abs(a) > maxAbs) maxAbs = Math.abs(a);
    }
    return cells.map((c) => {
      if (!c.key) return { ...c, amount: 0, level: "zero" as HeatLevel };
      const amount = entryMap.get(c.key)?.amount ?? 0;
      return { ...c, amount, level: heatLevel(amount, maxAbs) };
    });
  }, [calMonth, entryMap]);

  const pickerCells = useMemo(() => buildCells(pickerMonth), [pickerMonth]);

  /* ── Year available ── */
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    for (const k of entryMap.keys()) set.add(k.slice(0, 4));
    set.add(String(new Date().getFullYear()));
    return [...set].sort();
  }, [entryMap]);

  /* ── Year cells (12 months) ── */
  const yearCells = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const mk = `${calYear}-${String(i + 1).padStart(2, "0")}`;
      const amount = totals.monthly.get(mk) ?? 0;
      const label = new Date(Number(calYear), i, 1).toLocaleDateString(
        "en-US",
        { month: "short" },
      );
      const isCurrentMonth = mk === monthKeyOf();
      return { mk, amount, label, isCurrentMonth };
    });
    const maxAbs = Math.max(0, ...months.map((m) => Math.abs(m.amount)));
    return months.map((m) => ({ ...m, level: heatLevel(m.amount, maxAbs) }));
  }, [calYear, totals.monthly]);

  /* ── Recent ── */
  const recent = useMemo(
    () =>
      [...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12),
    [entries],
  );

  /* ── Interactions ── */
  function selectDay(dk: string) {
    const entry = entryMap.get(dk);
    setSelDate(dk);
    setFormAmt(entry ? entry.amount.toString() : "");
    setNotification(null);
  }

  function adjustDay(n: number) {
    const [y, m, d] = selDate.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + n);
    selectDay(localDateKey(dt));
  }

  async function savePnl(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setNotification(null);
    try {
      const amount = Number(formAmt.replace(",", "").trim());
      if (Number.isNaN(amount))
        throw new Error("Amount must be a valid number.");
      const res = await fetch("/api/pnl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selDate, amount }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to save.");
      setFormAmt(amount.toString());
      setNotification({ type: "ok", msg: "Saved successfully." });
      await loadData();
    } catch (err) {
      setNotification({
        type: "err",
        msg: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  function deleteEntry() {
    if (!entryMap.get(selDate)) return;
    setConfirmDelete(true);
  }

  async function doDelete() {
    const entry = entryMap.get(selDate);
    if (!entry) return;
    setDeleting(true);
    setConfirmDelete(false);
    setNotification(null);
    try {
      const res = await fetch(`/api/pnl/${entry.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to delete.");
      }
      setFormAmt("");
      setNotification({ type: "ok", msg: "Entry deleted." });
      await loadData();
    } catch (err) {
      setNotification({
        type: "err",
        msg: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setDeleting(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/auth");
  }

  /* ── Chart data ── */
  const lineChartData = {
    labels: totals.lineLabels,
    datasets: [
      {
        label: "Cumulative PnL",
        data: totals.cumulative,
        borderColor: "#10b981",
        backgroundColor: "rgba(16,185,129,0.1)",
        borderWidth: 2,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: "#10b981",
        tension: 0.3,
      },
    ],
  };

  const barChartData = {
    labels: totals.monthKeys,
    datasets: [
      {
        label: "Monthly PnL",
        data: totals.monthData,
        backgroundColor: totals.monthData.map((v) =>
          v >= 0 ? "rgba(16,185,129,0.68)" : "rgba(244,63,94,0.68)",
        ),
        borderRadius: 6,
        borderSkipped: false as const,
      },
    ],
  };

  const doughnutData = {
    labels: ["Win", "Loss", "Flat"],
    datasets: [
      {
        data: [totals.wins, totals.losses, totals.flat],
        backgroundColor: ["#10b981", "#f43f5e", "#1e293b"],
        borderWidth: 0,
        hoverOffset: 8,
      },
    ],
  };

  /* ── Loading skeleton ── */
  if (loading && firstLoad.current) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030508]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 anim-spin rounded-full border-2 border-emerald-900 border-t-emerald-400" />
          <p className="text-xs text-slate-600">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  const curEntry = entryMap.get(selDate);

  /* ════════════════════ Render ═══════════════════════════════ */
  return (
    <div className="min-h-screen bg-[#030508]">
      {/* ── Sticky Nav ── */}
      <header
        className="nav-blur sticky top-0 z-50 border-b border-white/[0.045]"
        style={{ backgroundColor: "rgba(3,5,8,0.85)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/5">
              <span
                className="h-2.5 w-2.5 rounded-full bg-emerald-400"
                style={{ boxShadow: "0 0 8px 2px rgba(16,185,129,0.6)" }}
              />
            </div>
            <span className="text-sm font-semibold tracking-tight text-white">
              PnL Tracker
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="items-center gap-1.5 rounded-full border border-emerald-900/30 bg-emerald-900/10 px-3 py-1 flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-emerald-300/70">
                {username}
              </span>
            </div>
            <button
              onClick={() => void logout()}
              className="btn-ghost px-3 py-1.5 text-xs"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ── Stats Row ── */}
        <section className="stagger mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Total PnL"
            value={fmtCompact(totals.overall)}
            sub="All time"
            pos={totals.overall > 0}
            neg={totals.overall < 0}
          />
          <StatCard
            label="Today"
            value={fmtCompact(totals.todayPnl)}
            sub={dayLabel(todayKey())}
            pos={totals.todayPnl > 0}
            neg={totals.todayPnl < 0}
          />
          <StatCard
            label="This Month"
            value={fmtCompact(totals.monthPnl)}
            sub={monthLabel(monthKeyOf())}
            pos={totals.monthPnl > 0}
            neg={totals.monthPnl < 0}
          />
          <StatCard
            label="Win Rate"
            value={`${totals.winRate}%`}
            sub={`${totals.wins}W · ${totals.losses}L · ${totals.total} days`}
            pos={totals.winRate > 50}
            neg={totals.winRate > 0 && totals.winRate < 50}
          />
        </section>

        {/* ── Calendar + Form ── */}
        <section className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-5">
          {/* Calendar */}
          <div className="panel panel-hover p-5 xl:col-span-3">
            {/* Header: toggle + navigation */}
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {/* Month / Year toggle */}
              <div className="flex w-full rounded-lg border border-white/5 bg-black/40 p-0.5 sm:w-auto">
                <button
                  type="button"
                  onClick={() => setCalView("month")}
                  className={[
                    "w-1/2 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 sm:w-auto",
                    calView === "month"
                      ? "bg-emerald-500 text-black"
                      : "text-slate-500 hover:text-slate-200",
                  ].join(" ")}
                >
                  Month
                </button>
                <button
                  type="button"
                  onClick={() => setCalView("year")}
                  className={[
                    "w-1/2 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 sm:w-auto",
                    calView === "year"
                      ? "bg-emerald-500 text-black"
                      : "text-slate-500 hover:text-slate-200",
                  ].join(" ")}
                >
                  Year
                </button>
              </div>

              {/* Navigation */}
              <div className="grid w-full min-w-0 grid-cols-[32px_minmax(0,1fr)_32px_46px] items-center gap-1 sm:flex sm:w-auto">
                <button
                  type="button"
                  onClick={() =>
                    calView === "month"
                      ? setCalMonth(prevMonth(calMonth))
                      : setCalYear((y) => String(Number(y) - 1))
                  }
                  className="btn-ghost h-8 w-8 text-lg leading-none"
                  aria-label="Previous"
                >
                  ‹
                </button>
                <span className="min-w-0 truncate px-1 text-center text-sm font-semibold text-white sm:min-w-[120px]">
                  {calView === "month" ? monthLabel(calMonth) : calYear}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    calView === "month"
                      ? setCalMonth(nextMonth(calMonth))
                      : setCalYear((y) => String(Number(y) + 1))
                  }
                  className="btn-ghost h-8 w-8 text-lg leading-none"
                  aria-label="Next"
                >
                  ›
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setCalMonth(monthKeyOf(now));
                    setCalYear(String(now.getFullYear()));
                  }}
                  className="btn-ghost hidden h-8 px-2.5 text-xs"
                >
                  Now
                </button>
              </div>
            </div>

            {/* ── Month view ── */}
            {calView === "month" && (
              <>
                <div className="mb-2 grid grid-cols-7 text-center text-[10px] font-medium uppercase tracking-wider text-slate-700">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (d) => (
                      <div key={d}>{d}</div>
                    ),
                  )}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calCells.map((cell, i) => {
                    if (!cell.key)
                      return <div key={`b-${i}`} className="h-14 rounded-xl" />;
                    const isSelected = cell.key === selDate;
                    return (
                      <button
                        key={cell.key}
                        type="button"
                        title={`${cell.key}${cell.amount !== 0 ? " · " + fmt(cell.amount) : ""}`}
                        onClick={() => {
                          selectDay(cell.key!);
                          formRef.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "nearest",
                          });
                        }}
                        className={[
                          "heat-cell max-[400px]:h-12 h-14 overflow-hidden rounded-xl border p-1",
                          HEAT[cell.level],
                          isSelected
                            ? "heat-cell-selected border-emerald-400/80"
                            : "border-white/[0.04]",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "block text-left max-[400px]:text-[8px] text-[11px] leading-none",
                            cellDayCls(cell.level, cell.isToday),
                          ].join(" ")}
                        >
                          {cell.day}
                          {cell.isToday && (
                            <span className="ml-1 inline-block h-1 w-1 rounded-full bg-emerald-400 align-middle" />
                          )}
                        </span>
                        {cell.amount !== 0 && (
                          <span
                            className={[
                              "mt-1 block text-center max-[400px]:text-[10px] text-[12px] font-medium leading-none",
                              cellAmtCls(cell.level, cell.amount > 0),
                            ].join(" ")}
                          >
                            {new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: "USD",
                              maximumFractionDigits: 0,
                            }).format(cell.amount)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── Year view ── */}
            {calView === "year" && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {yearCells.map((m) => {
                  const isCurrentMonth = m.mk === monthKeyOf();
                  return (
                    <button
                      key={m.mk}
                      type="button"
                      title={`${m.mk} · ${fmt(m.amount)}`}
                      onClick={() => {
                        setCalMonth(m.mk);
                        setCalView("month");
                      }}
                      className={[
                        "heat-cell relative flex flex-col items-center justify-center gap-2 rounded-xl border py-4 px-2",
                        HEAT[m.level],
                        isCurrentMonth
                          ? "border-emerald-400/60"
                          : "border-white/[0.04]",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "text-xs font-semibold leading-none",
                          cellDayCls(m.level, isCurrentMonth),
                        ].join(" ")}
                      >
                        {m.label}
                        {isCurrentMonth && (
                          <span className="ml-1 inline-block h-1 w-1 rounded-full bg-emerald-400 align-middle" />
                        )}
                      </span>
                      <span
                        className={[
                          "text-[12px] font-medium leading-none",
                          m.amount === 0
                            ? "text-slate-700"
                            : cellAmtCls(m.level, m.amount > 0),
                        ].join(" ")}
                      >
                        {m.amount === 0
                          ? "—"
                          : new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: "USD",
                              maximumFractionDigits: 0,
                            }).format(m.amount)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div className="mt-4 flex items-center justify-end gap-2 text-[10px] text-slate-700">
              <span>Loss</span>
              <div className="flex items-center gap-0.5">
                {(
                  [
                    "heat-neg-3",
                    "heat-neg-2",
                    "heat-neg-1",
                    "heat-zero",
                    "heat-pos-1",
                    "heat-pos-2",
                    "heat-pos-3",
                  ] as const
                ).map((c) => (
                  <div key={c} className={`h-2.5 w-2.5 rounded-sm ${c}`} />
                ))}
              </div>
              <span>Gain</span>
            </div>
          </div>

          {/* Entry form + Win/Loss */}
          <div ref={formRef} className="flex flex-col gap-4 xl:col-span-2">
            {/* Entry form */}
            <article className="panel panel-hover p-5">
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-500/70">
                Daily Entry
              </p>

              <form onSubmit={savePnl} className="space-y-3">
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs text-slate-500">Date</label>
                    {selDate !== todayKey() && (
                      <button
                        type="button"
                        onClick={() => selectDay(todayKey())}
                        className="text-[10px] font-medium text-emerald-500 transition-colors hover:text-emerald-400"
                      >
                        Jump to Today
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => adjustDay(-1)}
                      className="btn-ghost flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03]"
                      title="Previous Day"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                    </button>

                    <div className="relative flex-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPickerMonth(selDate.slice(0, 7));
                          setShowDatePicker(!showDatePicker);
                        }}
                        className={[
                          "input-base flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-all",
                          showDatePicker
                            ? "border-emerald-500 ring-2 ring-emerald-500/10"
                            : "hover:border-emerald-500/40",
                        ].join(" ")}
                      >
                        <svg
                          className="text-emerald-500/80"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect
                            width="18"
                            height="18"
                            x="3"
                            y="4"
                            rx="2"
                            ry="2"
                          />
                          <line x1="16" x2="16" y1="2" y2="6" />
                          <line x1="8" x2="8" y1="2" y2="6" />
                          <line x1="3" x2="21" y1="10" y2="10" />
                        </svg>
                        <span className="font-medium">{dayLabel(selDate)}</span>
                      </button>

                      {showDatePicker && (
                        <div
                          ref={pickerRef}
                          className="anim-scale-in absolute left-0 top-full z-[100] mt-2 w-[280px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0f1a] p-3 shadow-2xl shadow-black/50"
                        >
                          {/* Picker Header */}
                          <div className="mb-3 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() =>
                                setPickerMonth(prevMonth(pickerMonth))
                              }
                              className="btn-ghost h-8 w-8 rounded-lg"
                            >
                              ‹
                            </button>
                            <span className="text-xs font-bold text-white">
                              {monthLabel(pickerMonth)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setPickerMonth(nextMonth(pickerMonth))
                              }
                              className="btn-ghost h-8 w-8 rounded-lg"
                            >
                              ›
                            </button>
                          </div>

                          {/* Days Header */}
                          <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-bold uppercase tracking-wider text-slate-600">
                            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                              <div key={i}>{d}</div>
                            ))}
                          </div>

                          {/* Days Grid */}
                          <div className="grid grid-cols-7 gap-1">
                            {pickerCells.map((cell, i) => {
                              if (!cell.key)
                                return <div key={i} className="h-8" />;
                              const isSelected = cell.key === selDate;
                              const isToday = cell.isToday;
                              return (
                                <button
                                  key={cell.key}
                                  type="button"
                                  onClick={() => {
                                    selectDay(cell.key!);
                                    setShowDatePicker(false);
                                  }}
                                  className={[
                                    "flex h-8 w-8 items-center justify-center rounded-lg text-[11px] transition-all",
                                    isSelected
                                      ? "bg-emerald-500 font-bold text-black"
                                      : isToday
                                        ? "bg-emerald-500/10 font-bold text-emerald-400 hover:bg-emerald-500/20"
                                        : "text-slate-400 hover:bg-white/5 hover:text-white",
                                  ].join(" ")}
                                >
                                  {cell.day}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => adjustDay(1)}
                      className="btn-ghost flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03]"
                      title="Next Day"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-slate-500">
                    PnL Amount (USD)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formAmt}
                    onChange={(e) => setFormAmt(e.target.value)}
                    placeholder="e.g. 350.00 or -120.50"
                    className="input-base w-full px-3 py-2.5 text-sm tabnum"
                  />
                </div>

                {/* Selected day info */}
                {curEntry && (
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Existing Entry:</span>
                    <span
                      className={["font-medium", pnlCls(curEntry.amount)].join(
                        " ",
                      )}
                    >
                      {fmt(curEntry.amount)}
                    </span>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary flex-1 py-2.5 text-sm"
                  >
                    {saving ? (
                      <span className="flex items-center gap-1.5">
                        <span className="h-3.5 w-3.5 anim-spin rounded-full border-2 border-black/25 border-t-black" />
                        Saving…
                      </span>
                    ) : curEntry ? (
                      "Update"
                    ) : (
                      "Save"
                    )}
                  </button>
                  {curEntry && (
                    <button
                      type="button"
                      onClick={deleteEntry}
                      disabled={deleting}
                      className="rounded-lg border border-rose-900/30 bg-rose-950/20 px-4 text-sm text-rose-400 transition hover:bg-rose-900/20 hover:text-rose-300 disabled:opacity-40"
                    >
                      {deleting ? "…" : "Delete"}
                    </button>
                  )}
                </div>

                {notification && (
                  <div
                    className={[
                      "anim-slide-down rounded-lg px-3 py-2 text-xs border",
                      notification.type === "ok"
                        ? "border-emerald-900/40 bg-emerald-950/30 text-emerald-300"
                        : "border-rose-900/40 bg-rose-950/30 text-rose-300",
                    ].join(" ")}
                  >
                    {notification.msg}
                  </div>
                )}
              </form>
            </article>

            {/* Win / Loss doughnut */}
            <article className="panel panel-hover flex-1 p-5">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-500/70">
                Win / Loss
              </p>
              {totals.total === 0 ? (
                <div className="flex h-36 items-center justify-center text-xs text-slate-700">
                  No data yet
                </div>
              ) : (
                <>
                  <div className="h-40">
                    <Doughnut
                      data={doughnutData}
                      options={{
                        maintainAspectRatio: false,
                        cutout: "74%",
                        animation: { duration: 600 },
                        plugins: {
                          legend: {
                            position: "bottom",
                            labels: {
                              color: "#475569",
                              boxWidth: 9,
                              padding: 14,
                              font: { size: 11 },
                            },
                          },
                          tooltip: {
                            ...TOOLTIP,
                            callbacks: {
                              label: (ctx) =>
                                ` ${ctx.label}: ${ctx.formattedValue} days`,
                            },
                          },
                        },
                      }}
                    />
                  </div>
                  <div className="mt-3 flex justify-center gap-4 text-xs text-slate-600">
                    <span>
                      <span
                        className={`font-semibold tabnum ${totals.winRate >= 50 ? "pnl-pos" : "pnl-neg"}`}
                      >
                        {totals.winRate}%
                      </span>{" "}
                      win rate
                    </span>
                    <span>{totals.total} total days</span>
                  </div>
                </>
              )}
            </article>
          </div>
        </section>

        {/* ── Cumulative PnL ── */}
        <section className="mb-5 panel panel-hover p-5">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-500/70">
            Cumulative PnL
          </p>
          {totals.cumulative.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-sm text-slate-700">
              Start logging your daily PnL to see the trend
            </div>
          ) : (
            <div className="h-52">
              <Line
                data={lineChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  animation: { duration: 700 },
                  interaction: { intersect: false, mode: "index" },
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      ...TOOLTIP,
                      callbacks: {
                        label: (ctx) => ` ${fmt(Number(ctx.parsed.y ?? 0))}`,
                      },
                    },
                  },
                  scales: {
                    x: {
                      ...AXIS_STYLE,
                      ticks: { ...AXIS_STYLE.ticks, maxTicksLimit: 9 },
                    },
                    y: {
                      ...AXIS_STYLE,
                      ticks: {
                        ...AXIS_STYLE.ticks,
                        callback: (v) =>
                          `$${Number(v) >= 0 ? "+" : ""}${(Number(v) / 1000).toFixed(1)}K`,
                      },
                    },
                  },
                }}
              />
            </div>
          )}
        </section>

        {/* ── Monthly Chart + Recent ── */}
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {/* Monthly bar */}
          <article className="panel panel-hover p-5">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-500/70">
              Monthly PnL
            </p>
            {totals.monthData.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-slate-700">
                No data
              </div>
            ) : (
              <div className="h-48">
                <Bar
                  data={barChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 600 },
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        ...TOOLTIP,
                        callbacks: {
                          label: (ctx) => ` ${fmt(Number(ctx.parsed.y ?? 0))}`,
                        },
                      },
                    },
                    scales: {
                      x: AXIS_STYLE,
                      y: {
                        ...AXIS_STYLE,
                        ticks: {
                          ...AXIS_STYLE.ticks,
                          callback: (v) =>
                            `$${Number(v) >= 0 ? "+" : ""}${(Number(v) / 1000).toFixed(1)}K`,
                        },
                      },
                    },
                  }}
                />
              </div>
            )}
          </article>

          {/* Recent entries */}
          <article className="panel panel-hover p-5">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-500/70">
              Recent Entries
            </p>
            {recent.length === 0 ? (
              <p className="text-sm text-slate-700">No entries yet.</p>
            ) : (
              <div className="max-h-48 space-y-0.5 overflow-y-auto pr-1">
                {recent.map((e) => {
                  const dk = isoToKey(e.date);
                  const isSelected = dk === selDate;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => {
                        selectDay(dk);
                        if (dk.slice(0, 7) !== calMonth)
                          setCalMonth(dk.slice(0, 7));
                        formRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "nearest",
                        });
                      }}
                      className={[
                        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition",
                        isSelected
                          ? "bg-emerald-900/20 ring-1 ring-emerald-500/25"
                          : "hover:bg-white/[0.04]",
                      ].join(" ")}
                    >
                      <span className="text-xs text-slate-500">
                        {dayLabel(dk)}
                      </span>
                      <span
                        className={`text-sm font-semibold tabnum ${pnlCls(e.amount)}`}
                      >
                        {fmt(e.amount)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </article>
        </section>
      </main>

      {/* ── Delete Confirm Modal ── */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={() => setConfirmDelete(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />

          {/* Card */}
          <div
            className="anim-scale-in relative w-full max-w-[340px] rounded-2xl border border-white/[0.07] p-6"
            style={{
              background: "#0d0f18",
              boxShadow:
                "0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(244,63,94,0.08)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon */}
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-rose-900/40 bg-rose-950/30">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </div>

            <h3 className="text-base font-semibold text-white">Delete Entry</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Delete PnL for{" "}
              <span className="font-medium text-slate-300">
                {dayLabel(selDate)}
              </span>
              ?
              <br />
              <span className="text-xs">This action cannot be undone.</span>
            </p>

            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="btn-ghost flex-1 rounded-xl py-2.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void doDelete()}
                disabled={deleting}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all duration-150 disabled:opacity-50"
                style={{ background: "#e11d48" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "#f43f5e";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "#e11d48";
                }}
              >
                {deleting ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <span className="h-3.5 w-3.5 anim-spin rounded-full border-2 border-white/20 border-t-white" />
                    Deleting…
                  </span>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Sub-components ─────────────────── */
function StatCard({
  label,
  value,
  sub,
  pos,
  neg,
}: {
  label: string;
  value: string;
  sub: string;
  pos: boolean;
  neg: boolean;
}) {
  return (
    <article className="panel anim-fade-up">
      <div className="p-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-700">
          {label}
        </p>
        <p
          className={[
            "mt-2 text-xl font-bold tabnum",
            pos ? "pnl-pos" : neg ? "pnl-neg" : "text-slate-400",
          ].join(" ")}
        >
          {value}
        </p>
        <p className="mt-1 truncate text-[11px] text-slate-700">{sub}</p>
      </div>
    </article>
  );
}
