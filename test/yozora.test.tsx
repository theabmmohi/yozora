import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { centerOf, mockGeometry, pointer, tabs4 } from "./helpers"
import { renderToString } from "react-dom/server"
import { Yozora } from "../src"

const tabEl = (label: string) => screen.getByText(label).closest("[data-yozora-tab]") as HTMLElement
const root = () => document.querySelector("[data-yozora-root]") as HTMLElement

beforeEach(() => {
  mockGeometry()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("selection", () => {
  it("falls back to the first enabled tab", () => {
    const tabs = [{ ...tabs4[0], disabled: true }, ...tabs4.slice(1)]
    render(<Yozora tabs={tabs} />)
    expect(tabEl("A")?.hasAttribute("aria-current")).toBe(false)
    expect(tabEl("B")?.getAttribute("aria-current")).toBe("page")
  })

  it("picks an active tab once async tabs arrive", () => {
    const { rerender } = render(<Yozora tabs={[]} />)
    expect(root().querySelector("[aria-current]")).toBeNull()
    rerender(<Yozora tabs={tabs4} />)
    expect(tabEl("A")?.getAttribute("aria-current")).toBe("page")
  })

  it("respects defaultValue", () => {
    render(<Yozora tabs={tabs4} defaultValue="c" />)
    expect(tabEl("C")?.getAttribute("aria-current")).toBe("page")
  })

  it("controlled: calls onValueChange but does not move until value changes", () => {
    const onValueChange = vi.fn()
    const { rerender } = render(<Yozora tabs={tabs4} value="a" onValueChange={onValueChange} />)
    pointer(tabEl("C"), "pointerdown", centerOf(2))
    pointer(root(), "pointerup", centerOf(2))
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenCalledWith("c")
    expect(tabEl("A")?.getAttribute("aria-current")).toBe("page")
    rerender(<Yozora tabs={tabs4} value="c" onValueChange={onValueChange} />)
    expect(tabEl("C")?.getAttribute("aria-current")).toBe("page")
  })
})

describe("gestures", () => {
  it("tap selects the pressed tab on release", () => {
    const onValueChange = vi.fn()
    render(<Yozora tabs={tabs4} onValueChange={onValueChange} />)
    pointer(tabEl("B"), "pointerdown", centerOf(1))
    expect(onValueChange).not.toHaveBeenCalled()
    pointer(root(), "pointerup", centerOf(1))
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenCalledWith("b")
  })

  it("hold on an unselected tab, slide, and commit only on release", () => {
    const onValueChange = vi.fn()
    render(<Yozora tabs={tabs4} onValueChange={onValueChange} />)
    pointer(tabEl("C"), "pointerdown", centerOf(2))
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(root()?.getAttribute("data-armed")).toBe("true")
    pointer(root(), "pointermove", centerOf(3))
    expect(onValueChange).not.toHaveBeenCalled()
    expect(tabEl("D")?.getAttribute("data-active")).toBe("true")
    pointer(root(), "pointerup", centerOf(3))
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenCalledWith("d")
  })

  it("a swipe from an unselected tab without holding selects nothing", () => {
    const onValueChange = vi.fn()
    render(<Yozora tabs={tabs4} onValueChange={onValueChange} />)
    pointer(tabEl("D"), "pointerdown", centerOf(3))
    pointer(root(), "pointermove", centerOf(2))
    pointer(root(), "pointermove", centerOf(1))
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(root()?.getAttribute("data-armed")).toBe("false")
    pointer(root(), "pointerup", centerOf(1))
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("pressing the selected tab starts sliding immediately", () => {
    const onValueChange = vi.fn()
    render(<Yozora tabs={tabs4} defaultValue="b" onValueChange={onValueChange} />)
    pointer(tabEl("B"), "pointerdown", centerOf(1))
    expect(root()?.getAttribute("data-armed")).toBe("true")
    pointer(root(), "pointermove", centerOf(2))
    pointer(root(), "pointerup", centerOf(2))
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenCalledWith("c")
  })

  it("a cancelled touch commits nothing", () => {
    const onValueChange = vi.fn()
    render(<Yozora tabs={tabs4} defaultValue="b" onValueChange={onValueChange} />)
    pointer(tabEl("B"), "pointerdown", centerOf(1))
    pointer(root(), "pointermove", centerOf(3))
    pointer(root(), "pointercancel", centerOf(3))
    expect(onValueChange).not.toHaveBeenCalled()
    expect(root()?.getAttribute("data-armed")).toBe("false")
  })

  it("dragging past the ends clamps to the first and last tab", () => {
    const onValueChange = vi.fn()
    render(<Yozora tabs={tabs4} defaultValue="b" onValueChange={onValueChange} />)
    pointer(tabEl("B"), "pointerdown", centerOf(1))
    pointer(root(), "pointermove", 900)
    pointer(root(), "pointerup", 900)
    expect(onValueChange).toHaveBeenCalledWith("d")
  })

  it("disabled tabs cannot be selected by tap", () => {
    const onValueChange = vi.fn()
    const tabs = tabs4.map((t) => (t.id === "c" ? { ...t, disabled: true } : t))
    render(<Yozora tabs={tabs} onValueChange={onValueChange} />)
    pointer(tabEl("C"), "pointerdown", centerOf(2))
    pointer(root(), "pointerup", centerOf(2))
    expect(onValueChange).not.toHaveBeenCalled()
  })
})

describe("keyboard", () => {
  it("with no active tab, ArrowLeft goes to the last tab and ArrowRight to the first", () => {
    const { rerender } = render(<Yozora tabs={tabs4} value="none" semantics="tabs" />)
    fireEvent.keyDown(root(), { key: "ArrowLeft" })
    expect(document.activeElement).toBe(tabEl("D"))
    rerender(<Yozora tabs={tabs4} value="none" semantics="tabs" />)
    fireEvent.keyDown(root(), { key: "ArrowRight" })
    expect(document.activeElement).toBe(tabEl("A"))
  })

  it("tabs semantics selects as focus moves", () => {
    const onValueChange = vi.fn()
    render(<Yozora tabs={tabs4} semantics="tabs" onValueChange={onValueChange} />)
    fireEvent.keyDown(root(), { key: "ArrowRight" })
    expect(onValueChange).toHaveBeenCalledWith("b")
  })

  it("navigation semantics only moves focus; Enter activates", () => {
    const onValueChange = vi.fn()
    render(<Yozora tabs={tabs4} onValueChange={onValueChange} />)
    fireEvent.keyDown(root(), { key: "ArrowRight" })
    expect(onValueChange).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(tabEl("B"))
    fireEvent.click(tabEl("B"), { detail: 0 })
    expect(onValueChange).toHaveBeenCalledWith("b")
  })

  it("arrow keys flip in RTL", () => {
    render(
      <div dir="rtl">
        <Yozora tabs={tabs4} semantics="tabs" defaultValue="b" />
      </div>
    )
    fireEvent.keyDown(root(), { key: "ArrowRight" })
    expect(document.activeElement).toBe(tabEl("A"))
  })

  it("skips disabled tabs", () => {
    const tabs = tabs4.map((t) => (t.id === "b" ? { ...t, disabled: true } : t))
    render(<Yozora tabs={tabs} semantics="tabs" />)
    fireEvent.keyDown(root(), { key: "ArrowRight" })
    expect(document.activeElement).toBe(tabEl("C"))
  })
})

describe("semantics and accessibility", () => {
  it("navigation (default): landmark, aria-current, no tab roles", () => {
    render(<Yozora tabs={tabs4} aria-label="Main" />)
    expect(screen.getByRole("navigation", { name: "Main" })).toBeTruthy()
    expect(tabEl("A")?.getAttribute("aria-current")).toBe("page")
    expect(tabEl("A")?.hasAttribute("role")).toBe(false)
    expect(tabEl("A")?.hasAttribute("aria-selected")).toBe(false)
  })

  it("tabs: tablist, aria-selected, aria-controls and a roving tabindex", () => {
    const tabs = tabs4.map((t) => ({ ...t, controls: `panel-${t.id}` }))
    render(<Yozora tabs={tabs} semantics="tabs" defaultValue="b" />)
    expect(screen.getByRole("tablist")).toBeTruthy()
    expect(tabEl("B")?.getAttribute("aria-selected")).toBe("true")
    expect(tabEl("B")?.getAttribute("aria-controls")).toBe("panel-b")
    expect(tabEl("B")?.getAttribute("tabindex")).toBe("0")
    expect(tabEl("A")?.getAttribute("tabindex")).toBe("-1")
  })

  it("warns once for an icon-only tab without aria-label", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const bad = [{ id: "nameless-tab", icon: <svg /> }] as never
    const { rerender } = render(<Yozora tabs={bad} />)
    rerender(<Yozora tabs={bad} />)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain("nameless-tab")
  })

  it("an aria-label alone is a valid accessible name", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Yozora tabs={[{ id: "named-tab", icon: <svg />, "aria-label": "Home" }]} />)
    expect(warn).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Home" })).toBeTruthy()
  })
})

describe("icons", () => {
  const tabs = [
    { id: "a", label: "A", icon: <svg data-kind="outline" />, activeIcon: <svg data-kind="filled" /> },
    { id: "b", label: "B", icon: <svg data-kind="outline" /> }
  ]

  it("renders the filled icon only for tabs that define activeIcon", () => {
    render(<Yozora tabs={tabs} />)
    expect(tabEl("A").querySelector("[data-yozora-icon-filled]")).not.toBeNull()
    expect(tabEl("A").querySelector("[data-yozora-icon]")?.getAttribute("data-swap")).toBe("true")
    expect(tabEl("B").querySelector("[data-yozora-icon-filled]")).toBeNull()
  })

  it("marks the selected tab active so CSS swaps outline for filled", () => {
    render(<Yozora tabs={tabs} defaultValue="a" />)
    expect(tabEl("A")?.getAttribute("data-active")).toBe("true")
    expect(tabEl("B")?.getAttribute("data-active")).toBe("false")
  })

  it("hides icons from assistive tech", () => {
    render(<Yozora tabs={tabs} />)
    expect(tabEl("A").querySelector("[data-yozora-icon]")?.getAttribute("aria-hidden")).toBe("true")
  })
})

describe("rendering", () => {
  it("renders on the server without touching the DOM", () => {
    const html = renderToString(<Yozora tabs={tabs4} defaultValue="b" />)
    expect(html).toContain('role="navigation"')
    expect(html).toContain('aria-current="page"')
  })

  it("does not rebuild observers for inline tabs arrays", () => {
    const observe = vi.fn()
    const disconnect = vi.fn()
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = observe
        disconnect = disconnect
        unobserve() {}
      }
    )
    const { rerender } = render(<Yozora tabs={[...tabs4]} />)
    const created = disconnect.mock.calls.length
    rerender(<Yozora tabs={[...tabs4]} />)
    rerender(<Yozora tabs={[...tabs4]} />)
    expect(disconnect.mock.calls.length).toBe(created)
    vi.unstubAllGlobals()
  })
})
