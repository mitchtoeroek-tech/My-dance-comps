"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFamily } from "@/context/FamilyContext";
import { useLiveComps } from "@/hooks/useLiveComps";
import {
  adelaideTodayIso,
  compsOnDate,
  formatDayHeading,
  formatMonthTitle,
  marksForDay,
  monthFromIso,
  monthGrid,
  selectCalendarComps,
  shiftMonth,
  sortDayComps,
  STATUS_DOT_CLASS,
  type CalendarMonth,
  type DayMarks,
} from "@/lib/calendar";
import { statusLabel, registrationStatus } from "@/lib/comps";
import { formatDateRange } from "@/lib/datetime";
import { resolveHomeState } from "@/lib/filter";
import type { Competition, RegistrationStatus } from "@/lib/types";
import {
  ChildFilterNote,
  ChildPicker,
  HomeStateChips,
  InterstateToggle,
  type LocationChip,
} from "./ChildPicker";
import { EmptyState } from "./EmptyState";
import { EnrolledButton } from "./EnrolledButton";
import { StatusPill } from "./StatusPill";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const LEGEND: { status: RegistrationStatus; swatch: string }[] = [
  { status: "open", swatch: "bg-status-open" },
  { status: "opens-soon", swatch: "bg-status-opening ring-1 ring-border" },
  { status: "closing-soon", swatch: "bg-status-closing" },
  { status: "closed", swatch: "bg-status-closed" },
  { status: "unknown", swatch: "bg-status-unknown ring-1 ring-border" },
];

export function CalendarView({
  initialComps,
}: {
  initialComps: Competition[];
}) {
  const {
    ready,
    selectedChild,
    state,
    setPreferredState,
    setSelectedChildId,
    setIncludeInterstate,
    isEnrolled,
    toggleEnrolled,
    isFavourite,
  } = useFamily();
  const { comps: liveComps } = useLiveComps(initialComps);
  const todayIso = useMemo(() => adelaideTodayIso(), []);
  const [month, setMonth] = useState<CalendarMonth>(() =>
    monthFromIso(todayIso),
  );
  const [selectedIso, setSelectedIso] = useState<string | null>(null);

  const homeState = ready
    ? resolveHomeState(selectedChild, state.preferredState)
    : null;
  const includeInterstate = ready ? state.includeInterstate : false;
  const child = ready ? selectedChild : null;

  const calendarComps = useMemo(
    () =>
      ready
        ? selectCalendarComps(liveComps, {
            filters: {
              query: "",
              includeInterstate,
              child,
              homeState,
            },
          })
        : [],
    [ready, liveComps, includeInterstate, child, homeState],
  );

  const locationChip: LocationChip | null = includeInterstate
    ? "ALL"
    : homeState;

  const onSelectLocation = (next: LocationChip) => {
    if (next === "ALL") {
      setIncludeInterstate(true);
      setSelectedIso(null);
      return;
    }
    setIncludeInterstate(false);
    setPreferredState(next);
    if (selectedChild && selectedChild.homeState !== next) {
      setSelectedChildId(null);
    }
    setSelectedIso(null);
  };

  const cells = useMemo(
    () => monthGrid(month.year, month.month),
    [month.year, month.month],
  );

  const marksByIso = useMemo(() => {
    const map = new Map<string, DayMarks>();
    for (const cell of cells) {
      map.set(
        cell.iso,
        marksForDay(calendarComps, cell.iso, state.enrolled ?? []),
      );
    }
    return map;
  }, [cells, calendarComps, state.enrolled]);

  const selectedComps = useMemo(() => {
    if (!selectedIso) return [];
    return sortDayComps(
      compsOnDate(calendarComps, selectedIso),
      state.enrolled ?? [],
    );
  }, [selectedIso, calendarComps, state.enrolled]);

  useEffect(() => {
    if (selectedIso && selectedComps.length === 0) {
      setSelectedIso(null);
    }
  }, [selectedIso, selectedComps.length]);

  const goPrev = () => setMonth((current) => shiftMonth(current, -1));
  const goNext = () => setMonth((current) => shiftMonth(current, 1));
  const goToday = () => setMonth(monthFromIso(todayIso));
  const isCurrentMonth =
    month.year === monthFromIso(todayIso).year &&
    month.month === monthFromIso(todayIso).month;

  const swipe = useSwipe(goNext, goPrev);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Calendar</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Dates for the selected state (plus National finals), matching the
          Comps list. Tap SA, Vic, NSW, or All to update the month immediately.
          Dots use the same entry-status colours as Comps. Enrolled comps in
          this filter get a star.
        </p>
      </div>

      <ChildPicker />
      <HomeStateChips
        showAll
        value={locationChip}
        onChange={onSelectLocation}
      />
      <InterstateToggle homeState={homeState} />
      <ChildFilterNote
        child={child}
        homeState={homeState}
        includeInterstate={includeInterstate}
      />

      <div className="rounded-card bg-surface px-4 py-3 text-sm shadow-card ring-1 ring-border">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Legend
        </p>
        <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
          {LEGEND.map((item) => (
            <li key={item.status} className="flex items-center gap-1.5">
              <span
                className={`h-3 w-3 shrink-0 rounded-full ${item.swatch}`}
                aria-hidden
              />
              <span className="text-xs font-semibold text-foreground">
                {statusLabel(item.status)}
              </span>
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span
              className="text-[12px] leading-none text-primary-ink"
              aria-hidden
            >
              ★
            </span>
            <span className="text-xs font-semibold text-foreground">
              Enrolled
            </span>
          </li>
        </ul>
      </div>

      <section
        className="rounded-card bg-surface p-3 shadow-card ring-1 ring-border"
        {...swipe}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="grid h-11 w-11 place-items-center rounded-control text-foreground ring-1 ring-border"
            aria-label="Previous month"
          >
            ‹
          </button>
          <div className="min-w-0 text-center">
            <p className="text-base font-bold text-foreground">
              {formatMonthTitle(month)}
            </p>
            {!isCurrentMonth ? (
              <button
                type="button"
                onClick={goToday}
                className="text-xs font-bold text-primary-ink underline"
              >
                Jump to today
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={goNext}
            className="grid h-11 w-11 place-items-center rounded-control text-foreground ring-1 ring-border"
            aria-label="Next month"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-bold text-muted-foreground">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((cell) => {
            const marks = marksByIso.get(cell.iso);
            const isToday = cell.iso === todayIso;
            const hasComps = Boolean(marks && marks.total > 0);
            const dayNumber = Number(cell.iso.slice(-2));
            return (
              <button
                key={cell.iso}
                type="button"
                disabled={!hasComps}
                onClick={() => setSelectedIso(cell.iso)}
                aria-current={isToday ? "date" : undefined}
                aria-label={dayAriaLabel(cell.iso, marks, isToday)}
                className={`relative flex min-h-14 flex-col items-center justify-center overflow-visible rounded-control px-0.5 py-1 ${dayCellTone(marks, isToday)} ${
                  cell.inMonth
                    ? "text-foreground"
                    : "text-muted-foreground/60"
                } ${hasComps ? "hover:brightness-95" : "cursor-default"}`}
              >
                {marks?.enrolled ? (
                  <span
                    className="absolute top-0 right-0 text-[11px] leading-none text-primary-ink"
                    aria-hidden
                  >
                    ★
                  </span>
                ) : null}
                <span className="text-sm font-bold">{dayNumber}</span>
                {marks && marks.total > 0 ? (
                  <DayMarksRow marks={marks} />
                ) : (
                  <span className="mt-1 h-1.5" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {!ready ? (
        <p className="text-sm text-muted-foreground">Loading your family…</p>
      ) : calendarComps.length === 0 ? (
        <EmptyState
          title="Nothing on this calendar yet"
          body={
            homeState || includeInterstate
              ? "No matching dates for this state. Try All, another state chip, or a different month."
              : "Pick a state chip (or All) so we can show dates instead of every event in Australia."
          }
          action={
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              Find comps
            </Link>
          }
        />
      ) : null}

      {selectedIso ? (
        <DaySheet
          iso={selectedIso}
          comps={selectedComps}
          isEnrolled={isEnrolled}
          toggleEnrolled={toggleEnrolled}
          isFavourite={isFavourite}
          onClose={() => setSelectedIso(null)}
        />
      ) : null}
    </div>
  );
}

function dayCellTone(marks: DayMarks | undefined, isToday: boolean): string {
  if (isToday) return "bg-primary-soft ring-2 ring-primary";
  const top = marks?.statuses[0];
  if (!top) return "";
  switch (top) {
    case "closing-soon":
      return "bg-status-closing/55";
    case "open":
      return "bg-status-open/45";
    case "opens-soon":
      return "bg-status-opening";
    case "closed":
      return "bg-status-closed/55";
    default:
      return "bg-status-unknown";
  }
}

function DayMarksRow({ marks }: { marks: DayMarks }) {
  return (
    <span className="mt-0.5 flex min-h-3 items-center justify-center gap-0.5">
      {marks.statuses.map((status) => (
        <span
          key={status}
          className={`h-2 w-2 rounded-full ${STATUS_DOT_CLASS[status]} ${
            status === "unknown" || status === "opens-soon"
              ? "ring-1 ring-border"
              : "ring-1 ring-white/70"
          }`}
          aria-hidden
        />
      ))}
      {marks.total > 1 ? (
        <span className="pl-0.5 text-[10px] font-extrabold leading-none text-foreground">
          {marks.total}
        </span>
      ) : null}
    </span>
  );
}

function dayAriaLabel(
  iso: string,
  marks: DayMarks | undefined,
  isToday: boolean,
): string {
  const heading = formatDayHeading(iso);
  const bits = [heading];
  if (isToday) bits.push("today");
  if (!marks || marks.total === 0) return bits.join(", ");
  bits.push(
    `${marks.total} ${marks.total === 1 ? "competition" : "competitions"}`,
  );
  bits.push(marks.statuses.map((status) => statusLabel(status)).join(", "));
  if (marks.enrolled) bits.push("enrolled");
  return bits.join(", ");
}

function DaySheet({
  iso,
  comps,
  isEnrolled,
  toggleEnrolled,
  isFavourite,
  onClose,
}: {
  iso: string;
  comps: Competition[];
  isEnrolled: (id: string) => boolean;
  toggleEnrolled: (id: string) => void;
  isFavourite: (id: string) => boolean;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-[rgb(31_58_52/0.35)]"
        aria-label="Close day details"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-day-title"
        className="relative z-10 max-h-[80dvh] w-full max-w-lg overflow-y-auto rounded-t-card bg-surface p-4 pb-8 shadow-card ring-1 ring-border sm:rounded-card"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2
              id="calendar-day-title"
              className="text-lg font-bold text-foreground"
            >
              {formatDayHeading(iso)}
            </h2>
            <p className="text-xs font-medium text-muted-foreground">
              {comps.length === 1
                ? "1 competition"
                : `${comps.length} competitions`}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-control text-lg font-bold text-muted-foreground ring-1 ring-border"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <ul className="space-y-3">
          {comps.map((comp) => {
            const enrolled = isEnrolled(comp.id);
            return (
              <li
                key={comp.id}
                className="rounded-card bg-background p-3 ring-1 ring-border"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <StatusPill status={registrationStatus(comp)} />
                  {enrolled ? (
                    <span className="inline-flex items-center gap-1 rounded-control bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary-ink">
                      ★ Enrolled
                    </span>
                  ) : null}
                  {isFavourite(comp.id) ? (
                    <span className="rounded-control bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                      Saved
                    </span>
                  ) : null}
                </div>
                <p className="font-bold leading-snug text-foreground">
                  {comp.name}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {formatDateRange(comp.startDate, comp.endDate)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {comp.suburb}, {comp.state} · {comp.organiser}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/comps/${comp.id}`}
                    className="inline-flex min-h-11 items-center rounded-control bg-primary px-3 py-1.5 text-xs font-bold text-white"
                  >
                    Details
                  </Link>
                  <EnrolledButton
                    enrolled={enrolled}
                    onClick={() => toggleEnrolled(comp.id)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function useSwipe(onLeft: () => void, onRight: () => void) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  return {
    onTouchStart: (event: React.TouchEvent) => {
      startX.current = event.changedTouches[0]?.clientX ?? null;
      startY.current = event.changedTouches[0]?.clientY ?? null;
    },
    onTouchEnd: (event: React.TouchEvent) => {
      if (startX.current == null || startY.current == null) return;
      const dx = (event.changedTouches[0]?.clientX ?? 0) - startX.current;
      const dy = (event.changedTouches[0]?.clientY ?? 0) - startY.current;
      startX.current = null;
      startY.current = null;
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) onLeft();
      else onRight();
    },
  };
}
