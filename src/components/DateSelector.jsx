import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  openPanelMotionClass,
  useOpenTransition,
} from '../hooks/useOpenTransition.js'
import { formatBnNumber } from '../utils/format.js'
import {
  ALL_DATES,
  DATE_PRESETS,
  WEEKDAY_LABELS_BN,
  clampIsoToToday,
  formatDateRangeBn,
  isAllDates,
  matchPresetId,
  monthGrid,
  normalizeEndDate,
  parseIsoDate,
  presetRange,
  todayIso,
  weekdayIndexSaturday,
} from '../utils/dateRange.js'

const panelClass =
  'bg-base-100 rounded-box shadow-lg border border-base-300 overflow-hidden flex flex-col w-80 max-w-[calc(100vw-16px)] origin-top-left'

const chipClass = 'btn btn-ghost btn-xs font-normal h-7 min-h-7'
const chipSelectedClass = `${chipClass} bg-base-300 hover:bg-base-300 pointer-events-none`

const formatChipDateBn = (iso) => {
  const d = parseIsoDate(iso)
  if (!d) return '—'
  return new Intl.DateTimeFormat('bn-BD', {
    day: 'numeric',
    month: 'short',
  }).format(d)
}

const rangeOfPreset = (preset) => {
  if (preset && Object.prototype.hasOwnProperty.call(preset, 'start')) {
    return { start: preset.start, end: preset.end ?? null }
  }
  return presetRange(preset?.id)
}

export const DateSelector = ({
  startDate,
  endDate = null,
  onChange,
  className = '',
  presets = DATE_PRESETS,
  allDatesLabel = 'শুরু – আজ',
  resetPresetId = 'today',
  minDate = null,
  maxDate = null,
}) => {
  const today = todayIso()
  const committedStart = isAllDates(startDate)
    ? ALL_DATES
    : clampIsoToToday(startDate || today)
  const committedEnd = isAllDates(committedStart)
    ? null
    : normalizeEndDate(committedStart, endDate)

  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const [open, setOpen] = useState(false)
  const { mounted, shown } = useOpenTransition(open)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [draftStart, setDraftStart] = useState(committedStart)
  const [draftEnd, setDraftEnd] = useState(committedEnd)
  const startDateObj =
    parseIsoDate(committedStart) ?? parseIsoDate(maxDate) ?? new Date()
  const [viewYear, setViewYear] = useState(startDateObj.getFullYear())
  const [viewMonth, setViewMonth] = useState(startDateObj.getMonth())

  const syncDraftFromCommitted = () => {
    setDraftStart(committedStart)
    setDraftEnd(committedEnd)
    const d =
      parseIsoDate(committedStart) ?? parseIsoDate(maxDate) ?? new Date()
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  const updatePos = () => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = Math.min(window.innerWidth - 16, 320)
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
    const top = r.bottom + 8
    setPos({ top, left, width })
  }

  useLayoutEffect(() => {
    if (!open) return
    updatePos()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onWin = () => updatePos()
    window.addEventListener('resize', onWin)
    window.addEventListener('scroll', onWin, true)
    return () => {
      window.removeEventListener('resize', onWin)
      window.removeEventListener('scroll', onWin, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (panelRef.current?.contains(e.target)) return
      if (triggerRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const openPanel = () => {
    syncDraftFromCommitted()
    setOpen(true)
  }

  const selectedPreset = (() => {
    if (isAllDates(draftStart)) {
      return presets.some((preset) => preset.id === 'all') ? 'all' : null
    }
    const normalized = normalizeEndDate(draftStart, draftEnd)
    for (const preset of presets) {
      if (preset.id === 'all') continue
      const range = rangeOfPreset(preset)
      if (range.start === draftStart && range.end === normalized) {
        return preset.id
      }
    }
    return matchPresetId(draftStart, draftEnd)
  })()
  const cells = useMemo(
    () => monthGrid(viewYear, viewMonth, today),
    [viewYear, viewMonth, today],
  )

  const todayDate = parseIsoDate(today) ?? new Date()
  const maxView = parseIsoDate(maxDate)
  const limitDate =
    maxView && maxView.getTime() < todayDate.getTime() ? maxView : todayDate
  const minView = parseIsoDate(minDate)
  const canGoNext =
    viewYear < limitDate.getFullYear() ||
    (viewYear === limitDate.getFullYear() && viewMonth < limitDate.getMonth())
  const canGoPrev =
    !minView ||
    viewYear > minView.getFullYear() ||
    (viewYear === minView.getFullYear() && viewMonth > minView.getMonth())

  const monthLabel = new Intl.DateTimeFormat('bn-BD', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(viewYear, viewMonth, 1))

  const applyPreset = (id) => {
    const preset = presets.find((item) => item.id === id)
    const range = rangeOfPreset(preset)
    setDraftStart(range.start)
    setDraftEnd(range.end)
    const d =
      parseIsoDate(isAllDates(range.start) ? maxDate : range.start) ??
      new Date()
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  const onReset = () => {
    if (presets.some((preset) => preset.id === resetPresetId)) {
      applyPreset(resetPresetId)
    } else if (presets[0]) applyPreset(presets[0].id)
    else applyPreset('today')
  }

  const onDayClick = (iso, disabled) => {
    if (disabled) return
    const next = clampIsoToToday(iso)
    if (isAllDates(draftStart) || !draftStart || (draftStart && draftEnd)) {
      setDraftStart(next)
      setDraftEnd(null)
    } else if (next === draftStart) {
      setDraftEnd(null)
    } else if (next < draftStart) {
      setDraftEnd(draftStart)
      setDraftStart(next)
    } else {
      setDraftEnd(next)
    }
    const d = parseIsoDate(next)
    if (d && d.getMonth() !== viewMonth) {
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }

  const onApply = () => {
    if (isAllDates(draftStart)) {
      onChange?.({ start: ALL_DATES, end: null })
      setOpen(false)
      return
    }
    const start = draftStart || today
    const end = normalizeEndDate(start, draftEnd)
    onChange?.({ start, end })
    setOpen(false)
  }

  const isAllDraft = isAllDates(draftStart)
  const markedStart = isAllDraft ? minDate : draftStart
  const markedEnd = isAllDraft ? maxDate : draftEnd || draftStart

  return (
    <div className={`form-control w-full max-w-xs ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className="input input-bordered input-sm w-full flex items-center justify-between gap-1 cursor-pointer text-left font-normal"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPanel())}
      >
        <span className="truncate">
          {isAllDates(committedStart)
            ? allDatesLabel
            : formatDateRangeBn(committedStart, committedEnd)}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 opacity-60 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          strokeWidth={1.75}
        />
      </button>

      {mounted
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="তারিখ নির্বাচন"
              className={`${panelClass} ${openPanelMotionClass(shown)}`}
              style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                zIndex: 80,
                maxWidth: 'calc(100vw - 16px)',
              }}
            >
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-square"
                    aria-label="আগের মাস"
                    disabled={!canGoPrev}
                    onClick={() => {
                      if (!canGoPrev) return
                      const d = new Date(viewYear, viewMonth - 1, 1)
                      setViewYear(d.getFullYear())
                      setViewMonth(d.getMonth())
                    }}
                  >
                    <ChevronLeft className="size-4" strokeWidth={1.75} />
                  </button>
                  <p className="text-sm font-medium">{monthLabel}</p>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-square"
                    aria-label="পরের মাস"
                    disabled={!canGoNext}
                    onClick={() => {
                      if (!canGoNext) return
                      const d = new Date(viewYear, viewMonth + 1, 1)
                      setViewYear(d.getFullYear())
                      setViewMonth(d.getMonth())
                    }}
                  >
                    <ChevronRight className="size-4" strokeWidth={1.75} />
                  </button>
                </div>

                <div className="grid grid-cols-7 mb-1">
                  {WEEKDAY_LABELS_BN.map((label) => (
                    <div
                      key={label}
                      className="text-center text-[11px] text-base-content/45 py-1"
                    >
                      {label}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {cells.map((cell) => {
                    const outOfBounds =
                      (minDate && cell.iso < minDate) ||
                      (maxDate && cell.iso > maxDate)
                    const disabled = cell.disabled || Boolean(outOfBounds)
                    const isStart = Boolean(
                      markedStart && cell.iso === markedStart,
                    )
                    const isEnd = Boolean(markedEnd && cell.iso === markedEnd)
                    const inRange = Boolean(
                      markedStart &&
                        markedEnd &&
                        cell.iso >= markedStart &&
                        cell.iso <= markedEnd,
                    )
                    const single = isStart && (!markedEnd || markedStart === markedEnd)
                    const weekStart = weekdayIndexSaturday(cell.iso) === 0
                    const weekEnd = weekdayIndexSaturday(cell.iso) === 6
                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        disabled={disabled}
                        onClick={() => onDayClick(cell.iso, disabled)}
                        className={[
                          'h-8 text-sm tabular-nums',
                          disabled ? 'opacity-30 cursor-not-allowed' : '',
                          !cell.inMonth && !disabled
                            ? 'text-base-content/35'
                            : '',
                          cell.iso === today && !inRange ? 'font-bold' : '',
                          inRange
                            ? 'bg-base-300 text-base-content font-medium'
                            : '',
                          inRange && (single || isStart || weekStart)
                            ? 'rounded-l-full'
                            : '',
                          inRange && (single || isEnd || weekEnd)
                            ? 'rounded-r-full'
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {formatBnNumber(cell.day)}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="px-3 pb-3 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-1">
                  {selectedPreset ? (
                    presets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className={[
                          chipClass,
                          selectedPreset === preset.id
                            ? 'bg-base-300 hover:bg-base-300'
                            : '',
                        ].join(' ')}
                        onClick={() => applyPreset(preset.id)}
                      >
                        {preset.label}
                      </button>
                    ))
                  ) : draftEnd ? (
                    <>
                      <span className={chipSelectedClass}>
                        {formatChipDateBn(draftStart)}
                      </span>
                      <span className="text-xs text-base-content/55 px-0.5">
                        থেকে
                      </span>
                      <span className={chipSelectedClass}>
                        {formatChipDateBn(draftEnd)}
                      </span>
                    </>
                  ) : (
                    <span className={chipSelectedClass}>
                      {formatChipDateBn(draftStart)}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm flex-1"
                    onClick={onReset}
                  >
                    রিসেট
                  </button>
                  <button
                    type="button"
                    className="btn btn-neutral btn-sm flex-1"
                    onClick={onApply}
                  >
                    সেট
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
