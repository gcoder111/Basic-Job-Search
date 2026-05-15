export function createRunDeadline({ totalBudgetMs, reserveMs = 0, nowMs = Date.now() }) {
  return {
    startedAtMs: nowMs,
    deadlineAtMs: nowMs + Math.max(0, totalBudgetMs - reserveMs),
    totalBudgetMs,
    reserveMs,
  };
}

export function getRemainingTimeMs(deadline, nowMs = Date.now()) {
  return Math.max(0, deadline.deadlineAtMs - nowMs);
}

export function getBudgetedTimeoutMs(deadline, nowMs, requestedTimeoutMs) {
  return Math.max(0, Math.min(requestedTimeoutMs, getRemainingTimeMs(deadline, nowMs)));
}

export function throwIfDeadlineExceeded(deadline, { nowMs = Date.now(), stage = "run" } = {}) {
  if (getRemainingTimeMs(deadline, nowMs) > 0) {
    return;
  }

  const error = new Error(`Total run time budget exhausted during ${stage}.`);
  error.name = "RunDeadlineExceededError";
  error.stopReason = "total-time-budget-exhausted";
  throw error;
}
