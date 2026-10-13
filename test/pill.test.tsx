import { act, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Yozora } from "../src"
import { MAX_RELEASE_VELOCITY, isSettled, squashAgainstWalls, stepSpring } from "../src/physics"
import { centerOf, mockGeometry, pointer, tabs4 } from "./helpers"

describe("spring", () => {
  it("settles on the target with a small overshoot", () => {
    const spring = { position: 0, velocity: 0 }
    let peak = 0
    for (let frame = 0; frame < 240; frame++) {
      stepSpring(spring, 300, 1 / 60)
      peak = Math.max(peak, spring.position)
    }
    expect(Number.isFinite(spring.position)).toBe(true)
    expect(isSettled(spring, 300)).toBe(true)
    expect(peak).toBeGreaterThan(300)
    expect(peak).toBeLessThan(300 * 1.06)
  })

  it("starts from a release velocity", () => {
    const spring = { position: 100, velocity: MAX_RELEASE_VELOCITY }
    stepSpring(spring, 100, 1 / 60)
    expect(spring.position).toBeGreaterThan(100)
  })
})

describe("walls", () => {
  const wallLeft = 5
  const wallRight = 405

  it("leaves the pill alone inside the walls", () => {
    expect(squashAgainstWalls(200, 100, wallLeft, wallRight)).toEqual({ left: 200, width: 100, scaleY: 1 })
  })

  it("pins the leading edge to the right wall and squashes", () => {
    const squashed = squashAgainstWalls(325, 100, wallLeft, wallRight)
    expect(squashed.left + squashed.width).toBeCloseTo(wallRight)
    expect(squashed.width).toBeLessThan(100)
    expect(squashed.scaleY).toBeGreaterThan(1)
  })

  it("pins the leading edge to the left wall and squashes", () => {
    const squashed = squashAgainstWalls(-15, 100, wallLeft, wallRight)
    expect(squashed.left).toBe(wallLeft)
    expect(squashed.width).toBeLessThan(100)
  })

  it("never squashes past the limit, however hard the push", () => {
    const squashed = squashAgainstWalls(5000, 100, wallLeft, wallRight)
    expect(squashed.width).toBeGreaterThanOrEqual(75 - 1e-6)
    expect(squashed.scaleY).toBeLessThanOrEqual(1 + 0.25 * 0.35 + 1e-6)
  })

  it("does nothing when squash is 0 (the pill would overflow)", () => {
    expect(squashAgainstWalls(325, 100, wallLeft, wallRight, 0)).toEqual({ left: 325, width: 100, scaleY: 1 })
  })
})

describe("pill in the component", () => {
  beforeEach(() => {
    mockGeometry()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const pill = () => document.querySelector("[data-yozora-pill]") as HTMLElement
  const root = () => document.querySelector("[data-yozora-root]") as HTMLElement
  const tab = (id: string) => document.querySelectorAll("[data-yozora-tab]")[["a", "b", "c", "d"].indexOf(id)] as HTMLElement
  const parse = () => {
    const left = Number(/translate3d\(([-\d.]+)px/.exec(pill().style.transform)![1])
    return { left, width: parseFloat(pill().style.width) }
  }

  it("snaps under the selected tab on mount, without animating in", () => {
    render(<Yozora tabs={tabs4} defaultValue="c" />)
    expect(parse()).toEqual({ left: 205, width: 100 })
  })

  it("glides to a newly selected tab and settles exactly on it", () => {
    render(<Yozora tabs={tabs4} />)
    pointer(tab("d"), "pointerdown", centerOf(3))
    pointer(root(), "pointerup", centerOf(3))
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(parse()).toEqual({ left: 305, width: 100 })
  })

  it("squashes against the wall instead of crossing it while dragging past the end", () => {
    render(<Yozora tabs={tabs4} defaultValue="d" />)
    pointer(tab("d"), "pointerdown", centerOf(3))
    pointer(root(), "pointermove", 2000)
    const { left, width } = parse()
    expect(left + width).toBeCloseTo(405)
    expect(width).toBeLessThan(100)
    expect(width).toBeGreaterThanOrEqual(75 - 1e-6)
  })

  it("springs back to the selected tab after dragging past the wall and cancelling", () => {
    render(<Yozora tabs={tabs4} defaultValue="d" />)
    pointer(tab("d"), "pointerdown", centerOf(3))
    pointer(root(), "pointermove", 2000)
    pointer(root(), "pointercancel", 2000)
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(parse()).toEqual({ left: 305, width: 100 })
  })
})
