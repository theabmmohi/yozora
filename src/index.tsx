"use client"

import { haptic, useControllableState, useIsomorphicLayoutEffect } from "./hooks"
import { forwardRef, useRef, useState, useCallback, useEffect } from "react"
import type { CSSProperties, PointerEvent, KeyboardEvent } from "react"
import type { YozoraProps } from "./types"
import "./styles.css"

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

const Yozora = forwardRef<HTMLDivElement, YozoraProps>(function Yozora(props, forwardedRef) {
  const {
    items,
    value: valueProp,
    defaultValue,
    onValueChange,
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

  const [value, setValue] = useControllableState<string | undefined>({
    value: valueProp,
    defaultValue: defaultValue ?? items[0]?.id,
    onChange: (id) => {
      if (id !== undefined) onValueChange?.(id)
    }
  })
  const activeIndex = items.findIndex((item) => item.id === value)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
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
    const next = items.map((_, i) => {
      const el = itemRefs.current[i]
      return el ? { left: el.offsetLeft, width: el.offsetWidth } : { left: 0, width: 0 }
    })
    setRects((prev) => (sameRects(prev, next) ? prev : next))
  }, [items])

  useIsomorphicLayoutEffect(() => {
    measure()
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(measure)
    if (rootRef.current) ro.observe(rootRef.current)
    return () => ro.disconnect()
  }, [measure, fullWidth])

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => () => clearTimeout(st.timer), [st])

  const commit = (i: number, quiet?: boolean) => {
    const item = items[i]
    if (!item || item.disabled || item.id === value) return
    setValue(item.id)
    if (!quiet && haptics) haptic(8)
  }

  const local = (clientX: number) => {
    const scale = st.armed ? ARMED_SCALE : 1
    return (clientX - st.base!.cx - st.tx) / scale + st.base!.w / 2
  }

  const tabAt = (lx: number) => rects.findIndex((r, i) => !items[i]?.disabled && lx >= r.left && lx < r.left + r.width)

  const track = (cx: number, cy: number) => {
    if (!st.base || !rects.length) return
    const first = rects[0]
    const last = rects[rects.length - 1]
    const lx = local(cx)

    const i = tabAt(clamp(lx, first.left, last.left + last.width - 0.01))
    if (i !== -1 && i !== st.preview) {
      st.preview = i
      setPreview(i)
      if (haptics) haptic(8)
    }

    const w = rects[st.preview]?.width ?? 0
    setDragX(clamp(lx - st.grab - w / 2, first.left, last.left + last.width - w))

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
    st.preview = tabAt(local(st.lx))
    setPreview(st.preview)
    track(st.lx, st.ly)
  }

  const end = () => {
    clearTimeout(st.timer)
    st.armed = false
    st.base = null
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
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    st.base = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: el.offsetWidth }
    st.sx = st.lx = e.clientX
    st.sy = st.ly = e.clientY
    st.tx = 0
    st.ty = 0
    st.moved = false
    st.grab = 0
    clearTimeout(st.timer)

    const hit = tabAt(local(e.clientX))
    if (hit !== -1 && hit === activeIndex) {
      const r0 = rects[hit]
      st.grab = local(e.clientX) - (r0.left + r0.width / 2)
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

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (st.armed && st.preview >= 0) commit(st.preview, true)
    else if (st.base && !st.armed && !st.moved) {
      const i = tabAt(local(e.clientX))
      if (i !== -1) commit(i)
    }
    end()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0)
    if (!enabled.length) return
    let next = -1
    if (e.key === "Home") next = enabled[0]
    else if (e.key === "End") next = enabled[enabled.length - 1]
    else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const dir = e.key === "ArrowRight" ? 1 : -1
      let i = activeIndex
      for (let n = 0; n < items.length; n++) {
        i = (i + dir + items.length) % items.length
        if (!items[i].disabled) {
          next = i
          break
        }
      }
    }
    if (next < 0) return
    e.preventDefault()
    commit(next)
    itemRefs.current[next]?.focus()
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
        role="tablist"
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
        {items.map((item, i) => (
          <button
            key={item.id}
            ref={(el) => {
              itemRefs.current[i] = el
            }}
            type="button"
            role="tab"
            aria-selected={i === activeIndex}
            aria-disabled={item.disabled || undefined}
            aria-label={item["aria-label"]}
            tabIndex={i === (activeIndex >= 0 ? activeIndex : 0) ? 0 : -1}
            data-yozora-item=""
            data-active={i === shown}
            data-disabled={item.disabled || undefined}
            className={cn(classNames?.item, item.className)}
            onClick={(e) => {
              if (e.detail === 0) commit(i)
            }}
          >
            <span data-yozora-icon="" className={classNames?.icon}>
              {item.icon}
            </span>
            {item.label != null && (
              <span data-yozora-label="" className={classNames?.label}>
                {item.label}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
})

Yozora.displayName = "Yozora"

export type { YozoraProps, YozoraItem, YozoraClassNames, YozoraDrift, YozoraTheme } from "./types"
export { Yozora }
