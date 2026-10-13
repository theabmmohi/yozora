"use client"

import { MAX_RELEASE_VELOCITY, RUBBER_BAND, isSettled, squashAgainstWalls, stepSpring } from "./physics"
import { haptic, useControllableState, useIsomorphicLayoutEffect, warnMissingName } from "./hooks"
import { forwardRef, useRef, useState, useCallback, useEffect } from "react"
import type { CSSProperties, PointerEvent, KeyboardEvent } from "react"
import type { SpringState } from "./physics"
import type { YozoraProps } from "./types"

const HOLD_DELAY = 250
const MOVE_TOLERANCE = 10
const ARMED_SCALE = 1.02
const DRIFT_RANGE = 160
const DEFAULT_DRIFT_X = 3
const DEFAULT_DRIFT_Y = 5
const DEFAULT_HAPTIC_TICK_DURATION = 50
const DEFAULT_HAPTIC_ARM_DURATION = 75

type Rect = { left: number; width: number }

type PillMotion = {
  left: SpringState
  width: SpringState
  targetLeft: number
  targetWidth: number
  wallLeft: number
  wallRight: number
  dragging: boolean
  initialized: boolean
  frameId: number
  lastTime: number
}

type Gesture = {
  holdTimer: ReturnType<typeof setTimeout> | undefined
  armed: boolean
  barMetrics: { centerX: number; centerY: number; width: number } | null
  startTabIndex: number
  startX: number
  startY: number
  lastX: number
  lastY: number
  driftX: number
  driftY: number
  grabOffset: number
  hasMoved: boolean
  previewIndex: number
  sampleTime: number
  releaseVelocity: number
}

function joinClassNames(...classNames: (string | undefined | false)[]) {
  return classNames.filter(Boolean).join(" ") || undefined
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function areRectsEqual(previousRects: Rect[], nextRects: Rect[]) {
  return previousRects.length === nextRects.length && previousRects.every((rect, index) => rect.left === nextRects[index].left && rect.width === nextRects[index].width)
}

function resolveDrift(drift: YozoraProps["drift"]) {
  if (drift === false) return { x: 0, y: 0 }
  if (drift === true || drift === undefined) return { x: DEFAULT_DRIFT_X, y: DEFAULT_DRIFT_Y }
  return { x: drift.x ?? DEFAULT_DRIFT_X, y: drift.y ?? DEFAULT_DRIFT_Y }
}

function resolveHaptics(haptics: YozoraProps["haptics"]) {
  if (haptics === false) return null
  if (haptics === true || haptics === undefined) return { tick: DEFAULT_HAPTIC_TICK_DURATION, arm: DEFAULT_HAPTIC_ARM_DURATION }
  return { tick: haptics.tick ?? DEFAULT_HAPTIC_TICK_DURATION, arm: haptics.arm ?? DEFAULT_HAPTIC_ARM_DURATION }
}

function readLiveShift(element: HTMLElement) {
  try {
    if (typeof DOMMatrixReadOnly === "undefined") return { x: 0, y: 0 }
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
    return { x: matrix.m41, y: matrix.m42 }
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
    ...restProps
  } = props

  const isTabsSemantics = semantics === "tabs"
  const hapticDurations = resolveHaptics(haptics)

  const [selectedId, setSelectedId] = useControllableState<string | undefined>({
    value: valueProp,
    defaultValue,
    onChange: (nextId) => {
      if (nextId !== undefined) onValueChange?.(nextId)
    }
  })
  const firstEnabledId = tabs.find((tab) => !tab.disabled)?.id
  const value = valueProp !== undefined ? valueProp : tabs.some((tab) => tab.id === selectedId) ? selectedId : firstEnabledId
  const activeIndex = tabs.findIndex((tab) => tab.id === value)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const latestTabsRef = useRef(tabs)
  latestTabsRef.current = tabs
  const [tabRects, setTabRects] = useState<Rect[]>([])
  const [mounted, setMounted] = useState(false)
  const [armed, setArmed] = useState(false)
  const [barShift, setBarShift] = useState({ x: 0, y: 0 })
  const [previewIndex, setPreviewIndex] = useState(-1)

  const gesture = useRef<Gesture>({
    holdTimer: undefined,
    armed: false,
    barMetrics: null,
    startTabIndex: -1,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    driftX: 0,
    driftY: 0,
    grabOffset: 0,
    hasMoved: false,
    previewIndex: -1,
    sampleTime: 0,
    releaseVelocity: 0
  }).current

  const pillRef = useRef<HTMLDivElement | null>(null)
  const pillMotion = useRef<PillMotion>({
    left: { position: 0, velocity: 0 },
    width: { position: 0, velocity: 0 },
    targetLeft: 0,
    targetWidth: 0,
    wallLeft: 0,
    wallRight: 0,
    dragging: false,
    initialized: false,
    frameId: 0,
    lastTime: 0
  }).current

  const paintPill = useCallback(() => {
    const pillElement = pillRef.current
    if (!pillElement) return
    const squashed = squashAgainstWalls(pillMotion.left.position, pillMotion.width.position, pillMotion.wallLeft, pillMotion.wallRight)
    pillElement.style.width = `${squashed.width}px`
    pillElement.style.transform = `translate3d(${squashed.left}px, 0, 0) scaleY(${squashed.scaleY})`
  }, [pillMotion])

  const runPillMotion = useCallback(() => {
    if (pillMotion.frameId) return
    pillMotion.lastTime = performance.now()
    const tick = (now: number) => {
      const deltaTime = Math.min((now - pillMotion.lastTime) / 1000, 1 / 30)
      pillMotion.lastTime = now
      if (!pillMotion.dragging) stepSpring(pillMotion.left, pillMotion.targetLeft, deltaTime)
      stepSpring(pillMotion.width, pillMotion.targetWidth, deltaTime)
      const leftSettled = pillMotion.dragging || isSettled(pillMotion.left, pillMotion.targetLeft)
      const widthSettled = isSettled(pillMotion.width, pillMotion.targetWidth)
      if (leftSettled && !pillMotion.dragging) {
        pillMotion.left.position = pillMotion.targetLeft
        pillMotion.left.velocity = 0
      }
      if (widthSettled) {
        pillMotion.width.position = pillMotion.targetWidth
        pillMotion.width.velocity = 0
      }
      paintPill()
      pillMotion.frameId = leftSettled && widthSettled ? 0 : requestAnimationFrame(tick)
    }
    pillMotion.frameId = requestAnimationFrame(tick)
  }, [pillMotion, paintPill])

  useEffect(() => () => cancelAnimationFrame(pillMotion.frameId), [pillMotion])

  const setRootElement = useCallback(
    (element: HTMLDivElement | null) => {
      rootRef.current = element
      if (typeof forwardedRef === "function") forwardedRef(element)
      else if (forwardedRef) forwardedRef.current = element
    },
    [forwardedRef]
  )

  const measure = useCallback(() => {
    const nextRects = latestTabsRef.current.map((_tab, index) => {
      const tabElement = tabRefs.current[index]
      return tabElement ? { left: tabElement.offsetLeft, width: tabElement.offsetWidth } : { left: 0, width: 0 }
    })
    setTabRects((previousRects) => (areRectsEqual(previousRects, nextRects) ? previousRects : nextRects))
  }, [])

  useIsomorphicLayoutEffect(() => {
    measure()
  })

  useIsomorphicLayoutEffect(() => {
    if (typeof ResizeObserver === "undefined") return
    const resizeObserver = new ResizeObserver(measure)
    if (rootRef.current) resizeObserver.observe(rootRef.current)
    tabRefs.current.slice(0, tabs.length).forEach((tabElement) => tabElement && resizeObserver.observe(tabElement))
    return () => resizeObserver.disconnect()
  }, [measure, fullWidth, tabs.length])

  useEffect(() => {
    const frameId = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frameId)
  }, [])

  useEffect(() => () => clearTimeout(gesture.holdTimer), [gesture])

  useEffect(() => {
    tabs.forEach(warnMissingName)
  }, [tabs])

  const commit = (tabIndex: number, quiet?: boolean) => {
    const tab = tabs[tabIndex]
    if (!tab || tab.disabled || tab.id === value) return
    setSelectedId(tab.id)
    if (!quiet && hapticDurations) haptic(hapticDurations.tick)
  }

  const toLocalX = (clientX: number) => {
    const scale = gesture.armed ? ARMED_SCALE : 1
    return (clientX - gesture.barMetrics!.centerX - gesture.driftX) / scale + gesture.barMetrics!.width / 2
  }

  const tabIndexAtX = (localX: number) => tabRects.findIndex((rect, index) => !tabs[index]?.disabled && localX >= rect.left && localX < rect.left + rect.width)

  const getTabBounds = () => ({
    leftEdge: Math.min(...tabRects.map((rect) => rect.left)),
    rightEdge: Math.max(...tabRects.map((rect) => rect.left + rect.width))
  })

  const trackPointer = (pointerX: number, pointerY: number) => {
    if (!gesture.barMetrics || !tabRects.length) return
    const { leftEdge, rightEdge } = getTabBounds()
    const localX = toLocalX(pointerX)

    const hoveredTabIndex = tabIndexAtX(clamp(localX, leftEdge, rightEdge - 0.01))
    if (hoveredTabIndex !== -1 && hoveredTabIndex !== gesture.previewIndex) {
      gesture.previewIndex = hoveredTabIndex
      setPreviewIndex(hoveredTabIndex)
      if (hapticDurations) haptic(hapticDurations.tick)
    }

    const pillWidth = tabRects[gesture.previewIndex]?.width ?? 0
    const maxLeft = rightEdge - pillWidth
    let draggedLeft = localX - gesture.grabOffset - pillWidth / 2
    if (draggedLeft < leftEdge) draggedLeft = leftEdge + (draggedLeft - leftEdge) * RUBBER_BAND
    else if (draggedLeft > maxLeft) draggedLeft = maxLeft + (draggedLeft - maxLeft) * RUBBER_BAND

    const now = performance.now()
    const elapsed = Math.max(now - gesture.sampleTime, 1)
    gesture.releaseVelocity = 0.6 * gesture.releaseVelocity + 0.4 * ((draggedLeft - pillMotion.left.position) / elapsed) * 1000
    gesture.sampleTime = now
    pillMotion.left.position = draggedLeft
    pillMotion.left.velocity = 0
    paintPill()

    const maxDrift = resolveDrift(drift)
    gesture.driftX = clamp((-(pointerX - gesture.barMetrics.centerX) / DRIFT_RANGE) * maxDrift.x, -maxDrift.x, maxDrift.x)
    gesture.driftY = clamp((-(pointerY - gesture.barMetrics.centerY) / DRIFT_RANGE) * maxDrift.y, -maxDrift.y, maxDrift.y)
    setBarShift({ x: gesture.driftX, y: gesture.driftY })
  }

  const arm = (quiet?: boolean) => {
    if (gesture.armed || !gesture.barMetrics) return
    gesture.armed = true
    gesture.sampleTime = performance.now()
    gesture.releaseVelocity = 0
    pillMotion.dragging = true
    setArmed(true)
    if (quiet !== true && hapticDurations) haptic(hapticDurations.arm)
    gesture.previewIndex = gesture.startTabIndex >= 0 ? gesture.startTabIndex : tabIndexAtX(toLocalX(gesture.lastX))
    setPreviewIndex(gesture.previewIndex)
    trackPointer(gesture.lastX, gesture.lastY)
  }

  const endGesture = () => {
    clearTimeout(gesture.holdTimer)
    if (gesture.armed) pillMotion.left.velocity = clamp(gesture.releaseVelocity, -MAX_RELEASE_VELOCITY, MAX_RELEASE_VELOCITY)
    pillMotion.dragging = false
    gesture.releaseVelocity = 0
    gesture.armed = false
    gesture.barMetrics = null
    gesture.startTabIndex = -1
    gesture.driftX = 0
    gesture.driftY = 0
    gesture.previewIndex = -1
    setArmed(false)
    setBarShift({ x: 0, y: 0 })
    setPreviewIndex(-1)
    runPillMotion()
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return
    const barElement = event.currentTarget
    const barRect = barElement.getBoundingClientRect()
    const liveBarShift = readLiveShift(barElement)
    try {
      barElement.setPointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }

    const pressedTabElement = (event.target as Element).closest?.("[data-yozora-tab]") ?? null
    const pressedTabIndex = pressedTabElement ? tabRefs.current.indexOf(pressedTabElement as HTMLButtonElement) : -1
    gesture.startTabIndex = pressedTabIndex >= 0 && !tabs[pressedTabIndex]?.disabled ? pressedTabIndex : -1

    gesture.barMetrics = {
      centerX: barRect.left + barRect.width / 2 - liveBarShift.x,
      centerY: barRect.top + barRect.height / 2 - liveBarShift.y,
      width: barElement.offsetWidth
    }
    gesture.startX = gesture.lastX = event.clientX
    gesture.startY = gesture.lastY = event.clientY
    gesture.driftX = liveBarShift.x
    gesture.driftY = liveBarShift.y
    gesture.hasMoved = false
    gesture.grabOffset = 0
    clearTimeout(gesture.holdTimer)

    if (gesture.startTabIndex >= 0 && gesture.startTabIndex === activeIndex) {
      const pressedTabRect = pressedTabElement!.getBoundingClientRect()
      gesture.grabOffset = event.clientX - (pressedTabRect.left + pressedTabRect.width / 2)
      arm(true)
    } else {
      gesture.holdTimer = setTimeout(arm, holdDelay)
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!gesture.barMetrics) return
    gesture.lastX = event.clientX
    gesture.lastY = event.clientY
    if (gesture.armed) trackPointer(event.clientX, event.clientY)
    else if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > MOVE_TOLERANCE) {
      gesture.hasMoved = true
      clearTimeout(gesture.holdTimer)
    }
  }

  const onPointerUp = () => {
    if (gesture.armed && gesture.previewIndex >= 0) commit(gesture.previewIndex, true)
    else if (gesture.barMetrics && !gesture.armed && !gesture.hasMoved && gesture.startTabIndex >= 0) commit(gesture.startTabIndex)
    endGesture()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabledTabIndexes = tabs.map((tab, tabIndex) => (tab.disabled ? -1 : tabIndex)).filter((tabIndex) => tabIndex >= 0)
    if (!enabledTabIndexes.length) return
    const isRightToLeft = getComputedStyle(event.currentTarget).direction === "rtl" || event.currentTarget.closest("[dir='rtl']") !== null
    let nextIndex = -1
    if (event.key === "Home") nextIndex = enabledTabIndexes[0]
    else if (event.key === "End") nextIndex = enabledTabIndexes[enabledTabIndexes.length - 1]
    else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      let direction = event.key === "ArrowRight" ? 1 : -1
      if (isRightToLeft) direction = -direction

      let candidateIndex = activeIndex < 0 ? (direction > 0 ? -1 : tabs.length) : activeIndex
      for (let attempt = 0; attempt < tabs.length; attempt++) {
        candidateIndex = (candidateIndex + direction + tabs.length) % tabs.length
        if (!tabs[candidateIndex].disabled) {
          nextIndex = candidateIndex
          break
        }
      }
    }
    if (nextIndex < 0) return
    event.preventDefault()
    if (isTabsSemantics) commit(nextIndex)
    tabRefs.current[nextIndex]?.focus()
  }

  const displayedIndex = previewIndex >= 0 ? previewIndex : activeIndex
  const pillRect = tabRects[displayedIndex]

  useIsomorphicLayoutEffect(() => {
    if (tabRects.length) {
      const { leftEdge, rightEdge } = getTabBounds()
      pillMotion.wallLeft = leftEdge
      pillMotion.wallRight = rightEdge
    }
    if (!pillRect) return
    pillMotion.targetLeft = pillRect.left
    pillMotion.targetWidth = pillRect.width
    const reduceMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!pillMotion.initialized || reduceMotion) {
      pillMotion.left = { position: pillRect.left, velocity: 0 }
      pillMotion.width = { position: pillRect.width, velocity: 0 }
      pillMotion.initialized = true
      paintPill()
      return
    }
    runPillMotion()
  }, [pillRect?.left, pillRect?.width, tabRects])

  const rootStyle = {
    ...style,
    ...(accent ? { "--yozora-accent": accent } : null),
    transform: `translate(${barShift.x}px, ${barShift.y}px) scale(${armed ? ARMED_SCALE : 1})`
  } as CSSProperties

  const containerStyle = {
    "--yozora-offset": typeof offset === "number" ? `${offset}px` : offset
  } as CSSProperties

  return (
    <div data-yozora-container="" data-position={position} className={joinClassNames(classNames?.container)} style={containerStyle}>
      <div
        {...restProps}
        ref={setRootElement}
        role={isTabsSemantics ? "tablist" : "navigation"}
        data-yozora-root=""
        data-styled={!unstyled}
        data-theme={theme}
        data-full-width={fullWidth}
        data-armed={armed}
        data-mounted={mounted}
        className={joinClassNames(className, classNames?.root)}
        style={rootStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={endGesture}
        onKeyDown={onKeyDown}
      >
        <div ref={pillRef} aria-hidden="true" data-yozora-pill="" data-dragging={armed} data-empty={!pillRect} className={classNames?.pill} />
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(buttonElement) => {
              tabRefs.current[index] = buttonElement
            }}
            type="button"
            role={isTabsSemantics ? "tab" : undefined}
            aria-selected={isTabsSemantics ? index === activeIndex : undefined}
            aria-current={!isTabsSemantics && index === activeIndex ? "page" : undefined}
            aria-controls={isTabsSemantics ? tab.controls : undefined}
            aria-disabled={tab.disabled || undefined}
            aria-label={tab["aria-label"]}
            tabIndex={isTabsSemantics ? (index === (activeIndex >= 0 ? activeIndex : 0) ? 0 : -1) : undefined}
            data-yozora-tab=""
            data-active={index === displayedIndex}
            data-disabled={tab.disabled || undefined}
            className={joinClassNames(classNames?.tab, tab.className)}
            onClick={(event) => {
              if (event.detail === 0) commit(index)
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

export type { YozoraProps, YozoraTab, YozoraClassNames, YozoraDrift, YozoraHaptics, YozoraTheme } from "./types"
export { Yozora }
