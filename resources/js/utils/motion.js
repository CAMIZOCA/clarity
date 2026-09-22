/**
 * Spring presets shared across the app, matching Apple's "Designing Fluid
 * Interfaces" defaults (damping ratio + response, not duration).
 *
 * Critically damped (`SPRING_MOVE`) is the default for anything that isn't a
 * direct result of a flick or drag — menus, panels, focus states. Bounce
 * (`SPRING_MOMENTUM` / `SPRING_SHEET`) is reserved for interactions where the
 * gesture itself carried velocity, so the overshoot reads as physical rather
 * than decorative.
 */

/** Move/reposition: no overshoot, settles fast. */
export const SPRING_MOVE = { type: 'spring', damping: 1, stiffness: 26, mass: 0.6 };

/** Drawers and bottom sheets: a little give, since they're dragged open/closed. */
export const SPRING_SHEET = { type: 'spring', bounce: 0.28, duration: 0.3 };

/** Momentum-driven interactions (flicks, drag release). */
export const SPRING_MOMENTUM = { type: 'spring', bounce: 0.3, duration: 0.4 };

/** Instant press feedback — see the skill's "respond on pointer-down" rule. */
export const TAP_FEEDBACK = { scale: 0.97 };
export const TAP_TRANSITION = { type: 'spring', damping: 1, stiffness: 500, mass: 0.4 };

/** Non-interruptible fades (toasts, banners) — still critically damped. */
export const FADE_SPRING = { type: 'spring', damping: 1, stiffness: 32, mass: 0.7 };

/** Reduced-motion equivalent: short cross-fade, no movement or overshoot. */
export const REDUCED_MOTION_TRANSITION = { duration: 0.15, ease: 'easeOut' };

export function prefersReducedMotion() {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Swaps a spring for a plain cross-fade when the user asked for reduced motion. */
export function motionTransition(spring) {
    return prefersReducedMotion() ? REDUCED_MOTION_TRANSITION : spring;
}
