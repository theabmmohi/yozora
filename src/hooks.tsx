import { useLayoutEffect, useEffect, useState, useRef, useCallback } from "react"

export const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect

export function useControllableState<T>({ value, defaultValue, onChange }: { value: T | undefined; defaultValue: T; onChange?: (next: T) => void }) {
  const [inner, setInner] = useState<T>(defaultValue)
  const controlled = value !== undefined
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const set = useCallback(
    (next: T) => {
      if (!controlled) setInner(next)
      onChangeRef.current?.(next)
    },
    [controlled]
  )
  return [controlled ? (value as T) : inner, set] as const
}

export function haptic(ms = 8) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(ms)
  } catch {
    /* ignore */
  }
}
