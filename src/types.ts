import type { ReactNode, HTMLAttributes } from "react"

type NativeProps = Omit<HTMLAttributes<HTMLDivElement>, "children" | "onChange" | "onKeyDown" | "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel">

export type YozoraTheme = "light" | "dark" | "system"

export interface YozoraItem {
  id: string
  icon: ReactNode
  label?: ReactNode
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

export interface YozoraClassNames {
  container?: string
  root?: string
  pill?: string
  item?: string
  icon?: string
  label?: string
}

export interface YozoraDrift {
  x?: number
  y?: number
}

export interface YozoraProps extends NativeProps {
  items: YozoraItem[]
  value?: string
  defaultValue?: string
  onValueChange?: (id: string) => void
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
