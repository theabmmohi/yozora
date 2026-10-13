export const SPRING_STIFFNESS = 420
export const SPRING_DAMPING_RATIO = 0.75
export const WALL_SQUASH = 0.20
export const WALL_BULGE = 0.35
export const RUBBER_BAND = 0.35
export const MAX_RELEASE_VELOCITY = 1500

export type SpringState = { position: number; velocity: number }

export function stepSpring(spring: SpringState, target: number, deltaTime: number, stiffness = SPRING_STIFFNESS, dampingRatio = SPRING_DAMPING_RATIO) {
  const damping = 2 * dampingRatio * Math.sqrt(stiffness)
  const substeps = 4
  const stepTime = deltaTime / substeps
  for (let step = 0; step < substeps; step++) {
    spring.velocity += (-stiffness * (spring.position - target) - damping * spring.velocity) * stepTime
    spring.position += spring.velocity * stepTime
  }
}

export function isSettled(spring: SpringState, target: number) {
  return Math.abs(spring.position - target) < 0.05 && Math.abs(spring.velocity) < 0.5
}

export function squashAgainstWalls(left: number, width: number, wallLeft: number, wallRight: number, maxSquash = WALL_SQUASH) {
  const overshoot = Math.max(wallLeft - left, left + width - wallRight, 0)
  if (overshoot === 0 || maxSquash <= 0 || width <= 0) return { left, width, scaleY: 1 }
  const maxCompression = maxSquash * width
  const compression = maxCompression * Math.tanh(overshoot / maxCompression)
  const squashedWidth = width - compression
  return {
    left: left < wallLeft ? wallLeft : wallRight - squashedWidth,
    width: squashedWidth,
    scaleY: 1 + (compression / width) * WALL_BULGE
  }
}
