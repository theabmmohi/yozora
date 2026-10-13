"use client"

import { haptic, useControllableState, useIsomorphicLayoutEffect, warnMissingName } from "./hooks"
import { forwardRef, useRef, useState, useCallback, useEffect } from "react"
import type { CSSProperties, PointerEvent, KeyboardEvent } from "react"
import type { YozoraProps } from "./types"

const HOLD_DELAY = 250
const MOVE_SLOP = 10
const ARMED_SCALE = 1.02
const DRIFT_RANGE = 160
const DEFAULT_DRIFT_X = 5
const DEFAULT_DRIFT_Y = 7

type Rect = { left: number; width: number }

type Gesture = {
  timer: ReturnType<typeof setTimeout> | undefined
  armed: boolean
  base: { cx: number; cy: number; w: number } | null
  startTab: number
  sx: number
  sy: number
  lx: number
  ly: number
  tx: number
  ty: number
  grab: number
  moved: boolean
  preview: number
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ") || undefined
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function sameRects(a: Rect[], b: Rect[]) {
  return a.length === b.length && a.every((r, i) => r.left === b[i].left && r.width === b[i].width)
}

function resolveDrift(drift: YozoraProps["drift"]) {
  if (drift === false) return { x: 0, y: 0 }
  if (drift === true || drift === undefined) return { x: DEFAULT_DRIFT_X, y: DEFAULT_DRIFT_Y }
  return { x: drift.x ?? DEFAULT_DRIFT_X, y: drift.y ?? DEFAULT_DRIFT_Y }
}

function liveShift(el: HTMLElement) {
  try {
    if (typeof DOMMatrixReadOnly === "undefined") return { x: 0, y: 0 }
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
    return { x: m.m41, y: m.m42 }
  } catch {
    return { x: 0, y: 0 }
  }
}

const Yozora = forwardRef<HTMLDivElement, YozoraProps>(function Yozora(props, forwardedRef) {
  const {
    tabs,
    value: valueProp,
    defaultValue,
    onValueChange,
    semantics = "navigation",
    theme = "system",
    accent,
    fullWidth = false,
    position = "bottom",
    offset = 16,
    classNames,
    unstyled = false,
    holdDelay = HOLD_DELAY,
    drift = true,
    haptics = true,
    className,
    style,
    ...rest
  } = props

  const isTabs = semantics === "tabs"

  const [selected, setSelected] = useControllableState<string | undefined>({
    value: valueProp,
    defaultValue,
    onChange: (id) => {
      if (id !== undefined) onValueChange?.(id)
    }
  })
  const firstEnabledId = tabs.find((t) => !t.disabled)?.id
  const value = valueProp !== undefined ? valueProp : tabs.some((t) => t.id === selected) ? selected : firstEnabledId
  const activeIndex = tabs.findIndex((t) => t.id === value)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs
  const [rects, setRects] = useState<Rect[]>([])
  const [mounted, setMounted] = useState(false)
  const [armed, setArmed] = useState(false)
  const [dragX, setDragX] = useState<number | null>(null)
  const [shift, setShift] = useState({ x: 0, y: 0 })
  const [preview, setPreview] = useState(-1)

  const st = useRef<Gesture>({
    timer: undefined,
    armed: false,
    base: null,
    startTab: -1,
    sx: 0,
    sy: 0,
    lx: 0,
    ly: 0,
    tx: 0,
    ty: 0,
    grab: 0,
    moved: false,
    preview: -1
  }).current

  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      rootRef.current = el
      if (typeof forwardedRef === "function") forwardedRef(el)
      else if (forwardedRef) forwardedRef.current = el
    },
    [forwardedRef]
  )

  const measure = useCallback(() => {
    const next = tabsRef.current.map((_, i) => {
      const el = tabRefs.current[i]
      return el ? { left: el.offsetLeft, width: el.offsetWidth } : { left: 0, width: 0 }
    })
    setRects((prev) => (sameRects(prev, next) ? prev : next))
  }, [])

  useIsomorphicLayoutEffect(() => {
    measure()
  })

  useIsomorphicLayoutEffect(() => {
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(measure)
    if (rootRef.current) ro.observe(rootRef.current)
    tabRefs.current.slice(0, tabs.length).forEach((el) => el && ro.observe(el))
    return () => ro.disconnect()
  }, [measure, fullWidth, tabs.length])

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => () => clearTimeout(st.timer), [st])

  useEffect(() => {
    tabs.forEach(warnMissingName)
  }, [tabs])

  const commit = (i: number, quiet?: boolean) => {
    const tab = tabs[i]
    if (!tab || tab.disabled || tab.id === value) return
    setSelected(tab.id)
    if (!quiet && haptics) haptic(8)
  }

  const local = (clientX: number) => {
    const scale = st.armed ? ARMED_SCALE : 1
    return (clientX - st.base!.cx - st.tx) / scale + st.base!.w / 2
  }

  const tabAt = (lx: number) => rects.findIndex((r, i) => !tabs[i]?.disabled && lx >= r.left && lx < r.left + r.width)

  const bounds = () => ({ min: Math.min(...rects.map((r) => r.left)), max: Math.max(...rects.map((r) => r.left + r.width)) })

  const track = (cx: number, cy: number) => {
    if (!st.base || !rects.length) return
    const { min, max } = bounds()
    const lx = local(cx)

    const i = tabAt(clamp(lx, min, max - 0.01))
    if (i !== -1 && i !== st.preview) {
      st.preview = i
      setPreview(i)
      if (haptics) haptic(8)
    }

    const w = rects[st.preview]?.width ?? 0
    setDragX(clamp(lx - st.grab - w / 2, min, max - w))

    const d = resolveDrift(drift)
    st.tx = clamp((-(cx - st.base.cx) / DRIFT_RANGE) * d.x, -d.x, d.x)
    st.ty = clamp((-(cy - st.base.cy) / DRIFT_RANGE) * d.y, -d.y, d.y)
    setShift({ x: st.tx, y: st.ty })
  }

  const arm = (quiet?: boolean) => {
    if (st.armed || !st.base) return
    st.armed = true
    setArmed(true)
    if (quiet !== true && haptics) haptic(14)
    st.preview = st.startTab >= 0 ? st.startTab : tabAt(local(st.lx))
    setPreview(st.preview)
    track(st.lx, st.ly)
  }

  const end = () => {
    clearTimeout(st.timer)
    st.armed = false
    st.base = null
    st.startTab = -1
    st.tx = 0
    st.ty = 0
    st.preview = -1
    setArmed(false)
    setDragX(null)
    setShift({ x: 0, y: 0 })
    setPreview(-1)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    const live = liveShift(el)
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }

    const target = (e.target as Element).closest?.("[data-yozora-tab]") ?? null
    const idx = target ? tabRefs.current.indexOf(target as HTMLButtonElement) : -1
    st.startTab = idx >= 0 && !tabs[idx]?.disabled ? idx : -1

    st.base = { cx: r.left + r.width / 2 - live.x, cy: r.top + r.height / 2 - live.y, w: el.offsetWidth }
    st.sx = st.lx = e.clientX
    st.sy = st.ly = e.clientY
    st.tx = live.x
    st.ty = live.y
    st.moved = false
    st.grab = 0
    clearTimeout(st.timer)

    if (st.startTab >= 0 && st.startTab === activeIndex) {
      const tr = target!.getBoundingClientRect()
      st.grab = e.clientX - (tr.left + tr.width / 2)
      arm(true)
    } else {
      st.timer = setTimeout(arm, holdDelay)
    }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!st.base) return
    st.lx = e.clientX
    st.ly = e.clientY
    if (st.armed) track(e.clientX, e.clientY)
    else if (Math.hypot(e.clientX - st.sx, e.clientY - st.sy) > MOVE_SLOP) {
      st.moved = true 
      clearTimeout(st.timer)
    }
  }

  const onPointerUp = () => {
    if (st.armed && st.preview >= 0)
      commit(st.preview, true)
    else if (st.base && !st.armed && !st.moved && st.startTab >= 0) commit(st.startTab)
    end()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const enabled = tabs.map((t, i) => (t.disabled ? -1 : i)).filter((i) => i >= 0)
    if (!enabled.length) return
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl" || e.currentTarget.closest("[dir='rtl']") !== null
    let next = -1
    if (e.key === "Home") next = enabled[0]
    else if (e.key === "End") next = enabled[enabled.length - 1]
    else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      let dir = e.key === "ArrowRight" ? 1 : -1
      if (rtl) dir = -dir
      
      let i = activeIndex < 0 ? (dir > 0 ? -1 : tabs.length) : activeIndex
      for (let n = 0; n < tabs.length; n++) {
        i = (i + dir + tabs.length) % tabs.length
        if (!tabs[i].disabled) {
          next = i
          break
        }
      }
    }
    if (next < 0) return
    e.preventDefault()
    if (isTabs) commit(next)
    tabRefs.current[next]?.focus()
  }

  const shown = preview >= 0 ? preview : activeIndex
  const pillRect = rects[shown]

  const rootStyle = {
    ...style,
    ...(accent ? { "--yozora-accent": accent } : null),
    transform: `translate(${shift.x}px, ${shift.y}px) scale(${armed ? ARMED_SCALE : 1})`
  } as CSSProperties

  const containerStyle = {
    "--yozora-offset": typeof offset === "number" ? `${offset}px` : offset
  } as CSSProperties

  return (
    <div data-yozora-container="" data-position={position} className={cn(classNames?.container)} style={containerStyle}>
      <div
        {...rest}
        ref={setRefs}
        role={isTabs ? "tablist" : "navigation"}
        data-yozora-root=""
        data-styled={!unstyled}
        data-theme={theme}
        data-full-width={fullWidth}
        data-armed={armed}
        data-mounted={mounted}
        className={cn(className, classNames?.root)}
        style={rootStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={end}
        onKeyDown={onKeyDown}
      >
        <div aria-hidden="true" data-yozora-pill="" data-dragging={dragX !== null} data-empty={!pillRect} className={classNames?.pill} style={{ width: pillRect?.width ?? 0, transform: `translateX(${dragX ?? pillRect?.left ?? 0}px)` }} />
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[i] = el
            }}
            type="button"
            role={isTabs ? "tab" : undefined}
            aria-selected={isTabs ? i === activeIndex : undefined}
            aria-current={!isTabs && i === activeIndex ? "page" : undefined}
            aria-controls={isTabs ? tab.controls : undefined}
            aria-disabled={tab.disabled || undefined}
            aria-label={tab["aria-label"]}
            tabIndex={isTabs ? (i === (activeIndex >= 0 ? activeIndex : 0) ? 0 : -1) : undefined}
            data-yozora-tab=""
            data-active={i === shown}
            data-disabled={tab.disabled || undefined}
            className={cn(classNames?.tab, tab.className)}
            onClick={(e) => {
              if (e.detail === 0) commit(i)
            }}
          >
            <span data-yozora-icon="" aria-hidden="true" data-swap={tab.activeIcon != null ? "true" : undefined} className={classNames?.icon}>
              <span data-yozora-icon-outline="">{tab.icon}</span>
              {tab.activeIcon != null && <span data-yozora-icon-filled="">{tab.activeIcon}</span>}
            </span>
            {tab.label != null && (
              <span data-yozora-label="" className={classNames?.label}>
                {tab.label}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
})

Yozora.displayName = "Yozora"

export type { YozoraProps, YozoraTab, YozoraClassNames, YozoraDrift, YozoraTheme } from "./types"
export { Yozora }
