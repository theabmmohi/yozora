import type { ReactNode, HTMLAttributes } from "react"

type NativeProps = Omit<HTMLAttributes<HTMLDivElement>, "children" | "onChange" | "onKeyDown" | "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel">

export type YozoraTheme = "light" | "dark" | "system"

type YozoraTabBase = {
  id: string
  icon: ReactNode
  activeIcon?: ReactNode
  disabled?: boolean
  className?: string
  controls?: string
}

export type YozoraTab = YozoraTabBase & ({ label: ReactNode; "aria-label"?: string } | { label?: undefined; "aria-label": string })

export interface YozoraClassNames {
  container?: string
  root?: string
  pill?: string
  tab?: string
  icon?: string
  label?: string
}

export interface YozoraDrift {
  x?: number
  y?: number
}

export interface YozoraProps extends NativeProps {
  tabs: YozoraTab[]
  value?: string
  defaultValue?: string
  onValueChange?: (id: string) => void
  semantics?: "navigation" | "tabs"
  theme?: YozoraTheme
  accent?: string
  fullWidth?: boolean
  position?: "bottom" | "top" | "static"
  offset?: number | string
  classNames?: YozoraClassNames
  unstyled?: boolean
  holdDelay?: number
  drift?: boolean | YozoraDrift
  haptics?: boolean
}
