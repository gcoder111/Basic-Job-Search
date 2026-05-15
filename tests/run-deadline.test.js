import test from "node:test";
import assert from "node:assert/strict";
import {
  createRunDeadline,
  getRemainingTimeMs,
  getBudgetedTimeoutMs,
  throwIfDeadlineExceeded,
} from "../app/utils/run-deadline.js";

test("createRunDeadline stores the configured total budget", () => {
  const deadline = createRunDeadline({ totalBudgetMs: 600000, nowMs: 1000 });

  assert.equal(deadline.startedAtMs, 1000);
  assert.equal(deadline.deadlineAtMs, 601000);
  assert.equal(deadline.totalBudgetMs, 600000);
});

test("createRunDeadline can reserve headroom for shutdown and artifact writing", () => {
  const deadline = createRunDeadline({ totalBudgetMs: 600000, reserveMs: 15000, nowMs: 1000 });

  assert.equal(deadline.deadlineAtMs, 586000);
  assert.equal(deadline.totalBudgetMs, 600000);
});

test("getBudgetedTimeoutMs caps waits to the remaining budget", () => {
  const deadline = createRunDeadline({ totalBudgetMs: 600000, nowMs: 1000 });

  assert.equal(getRemainingTimeMs(deadline, 3000), 598000);
  assert.equal(getBudgetedTimeoutMs(deadline, 3000, 20000), 20000);
  assert.equal(getBudgetedTimeoutMs(deadline, 600500, 20000), 500);
  assert.equal(getBudgetedTimeoutMs(deadline, 601500, 20000), 0);
});

test("throwIfDeadlineExceeded raises a tagged error once the total budget is exhausted", () => {
  const deadline = createRunDeadline({ totalBudgetMs: 600000, nowMs: 1000 });

  assert.throws(
    () => throwIfDeadlineExceeded(deadline, { nowMs: 601001, stage: "keyword-loop" }),
    (error) => {
      assert.equal(error.name, "RunDeadlineExceededError");
      assert.equal(error.stopReason, "total-time-budget-exhausted");
      assert.match(error.message, /keyword-loop/);
      return true;
    },
  );
});
