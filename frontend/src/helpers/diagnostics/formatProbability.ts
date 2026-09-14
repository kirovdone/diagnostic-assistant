// No decimal place. A number like 31.4% claims a precision the evidence does not have:
// these come from a handful of weighted votes, not from a calibrated model.
export function formatProbability(value: number): string {
  return `${Math.round(value * 100)}%`;
}
