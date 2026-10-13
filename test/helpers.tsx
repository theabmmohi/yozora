import { fireEvent } from "@testing-library/react"
import type { ReactNode } from "react"
import type { YozoraTab } from "../src"

export const TAB_W = 100
export const PAD = 5
export const centerOf = (i: number) => PAD + i * TAB_W + TAB_W / 2

const tabIndex = (el: Element) => Array.from(el.parentElement!.querySelectorAll("[data-yozora-tab]")).indexOf(el)

export function mockGeometry() {
  const proto = HTMLElement.prototype
  Object.defineProperty(proto, "offsetLeft", {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute("data-yozora-tab") ? PAD + tabIndex(this) * TAB_W : 0
    }
  })
  Object.defineProperty(proto, "offsetWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute("data-yozora-tab") ? TAB_W : this.hasAttribute("data-yozora-root") ? 410 : 0
    }
  })
  proto.getBoundingClientRect = function (this: HTMLElement) {
    if (this.hasAttribute("data-yozora-root")) return { left: 0, top: 0, width: 410, height: 50, right: 410, bottom: 50, x: 0, y: 0, toJSON() {} }
    if (this.hasAttribute("data-yozora-tab")) {
      const left = PAD + tabIndex(this) * TAB_W
      return { left, top: 5, width: TAB_W, height: 40, right: left + TAB_W, bottom: 45, x: left, y: 5, toJSON() {} }
    }
    return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} }
  }
}

export function pointer(el: Element, type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel", x: number, y = 25) {
  fireEvent(el, new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: "touch", button: 0 }))
}

const Dot = ({ n }: { n: string }): ReactNode => <svg data-icon={n} />

export const tabs4: YozoraTab[] = [
  { id: "a", label: "A", icon: <Dot n="a" /> },
  { id: "b", label: "B", icon: <Dot n="b" /> },
  { id: "c", label: "C", icon: <Dot n="c" /> },
  { id: "d", label: "D", icon: <Dot n="d" /> }
]
