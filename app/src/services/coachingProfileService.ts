/**
 * Coaching Profile Service — D.5 v1
 *
 * Two layers in one file:
 *
 * Layer 1 — Pure profile logic (no side effects, no store/BLE access):
 *   computeProfileThresholds(), getProfileLabel(), constants
 *
 * Layer 2 — Thin orchestration coordinator (reads stores, writes BLE):
 *   applyProfileForCurrentContext()
 *
 * Layer 1 is stateless and unit-testable with no mocking.
 * Layer 2 is the single authoritative path for all threshold writes
 * during an active session.
 */
import type { AlertThresholds } from '../types';
import type { SessionContext } from '../types';

// ============================================
// Layer 1 — Pure Profile Logic
// ============================================

/** Per-threshold multipliers for each profile. */
export const PROFILE_MULTIPLIERS: Record<
  SessionContext,
  { gentle: number; moderate: number; urgent: number; critical: number }
> = {
  solo: { gentle: 1.0, moderate: 1.0, urgent: 1.0, critical: 1.0 },
  with_others: { gentle: 0.7, moderate: 0.7, urgent: 0.65, critical: 0.75 },
  presentation: { gentle: 3.0, moderate: 3.0, urgent: 3.0, critical: 3.0 },
};

/** Internal safety rail — minimum seconds per threshold level. */
export const THRESHOLD_FLOORS = { gentle: 3, moderate: 5, urgent: 10, critical: 15 };

/** Internal safety rail — maximum seconds per threshold level. */
export const THRESHOLD_CEILINGS = { gentle: 30, moderate: 60, urgent: 120, critical: 300 };

/**
 * Compute derived thresholds for a given context.
 *
 * Application order: multiply → round → clamp floors → clamp ceilings → enforce monotonic.
 */
export function computeProfileThresholds(
  context: SessionContext,
  baseThresholds: AlertThresholds,
): AlertThresholds {
  const m = PROFILE_MULTIPLIERS[context];

  // Multiply + round
  let gentle = Math.round(baseThresholds.gentleSec * m.gentle);
  let moderate = Math.round(baseThresholds.moderateSec * m.moderate);
  let urgent = Math.round(baseThresholds.urgentSec * m.urgent);
  let critical = Math.round(baseThresholds.criticalSec * m.critical);

  // Clamp floors
  gentle = Math.max(gentle, THRESHOLD_FLOORS.gentle);
  moderate = Math.max(moderate, THRESHOLD_FLOORS.moderate);
  urgent = Math.max(urgent, THRESHOLD_FLOORS.urgent);
  critical = Math.max(critical, THRESHOLD_FLOORS.critical);

  // Clamp ceilings
  gentle = Math.min(gentle, THRESHOLD_CEILINGS.gentle);
  moderate = Math.min(moderate, THRESHOLD_CEILINGS.moderate);
  urgent = Math.min(urgent, THRESHOLD_CEILINGS.urgent);
  critical = Math.min(critical, THRESHOLD_CEILINGS.critical);

  // Enforce monotonic (strictly increasing)
  if (moderate <= gentle) moderate = gentle + 1;
  if (urgent <= moderate) urgent = moderate + 1;
  if (critical <= urgent) critical = urgent + 1;

  return {
    gentleSec: gentle,
    moderateSec: moderate,
    urgentSec: urgent,
    criticalSec: critical,
  };
}

/**
 * Profile label for UI display.
 *
 * Intentionally co-located with profile definitions — the label is a property
 * of the profile system, not a UI concern. The component consumes it as a
 * string prop without knowing which profile produced it.
 */
export function getProfileLabel(context: SessionContext): string {
  const labels: Record<SessionContext, string> = {
    solo: 'Standard alerts',
    with_others: 'Tighter alerts',
    presentation: 'Relaxed alerts',
  };
  return labels[context];
}
