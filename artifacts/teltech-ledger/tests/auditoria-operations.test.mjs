import test from "node:test";
import assert from "node:assert/strict";

test("Financial balance delta computation across accounts", () => {
  function calculateReconciliation({ oldTx, newTx, accountABalance, accountBBalance }) {
    let balA = accountABalance;
    let balB = accountBBalance;
    
    // 1. Revert old transaction if paid
    if (oldTx.status === "paid") {
      const oldAmount = Number(oldTx.amount);
      if (oldTx.type === "income") balA -= oldAmount;
      else if (oldTx.type === "expense") balA += oldAmount;
    }
    
    // 2. Apply new transaction if paid
    if (newTx.status === "paid") {
      const newAmount = Number(newTx.amount);
      if (newTx.type === "income") balB += newAmount;
      else if (newTx.type === "expense") balB -= newAmount;
    }
    
    return { balA, balB };
  }

  const result = calculateReconciliation({
    oldTx: { type: "expense", amount: 500, status: "paid", accountId: "acc-A" },
    newTx: { type: "expense", amount: 700, status: "paid", accountId: "acc-B" },
    accountABalance: 1500,
    accountBBalance: 1000,
  });

  assert.equal(result.balA, 2000, "Account A balance should be restored to 2000");
  assert.equal(result.balB, 300, "Account B balance should be deducted by 700 to 300");
});

test("OKR completion percentage handles empty targets and KRs accurately", () => {
  const calcProgress = (current, target) => {
    if (target === 0) return 0;
    return Math.min(100, Math.round((current / target) * 100));
  };

  const getObjectiveProgress = (krList = []) => {
    if (krList.length === 0) return 0;
    const sum = krList.reduce((acc, kr) => acc + calcProgress(kr.currentValue, kr.targetValue), 0);
    return Math.round(sum / krList.length);
  };

  // Case 1: Empty KR list
  assert.equal(getObjectiveProgress([]), 0);

  // Case 2: Target = 0 should not divide by zero or yield NaN
  assert.equal(calcProgress(50, 0), 0);

  // Case 3: Multiple KRs with different weights
  const krs = [
    { currentValue: 10, targetValue: 20 },
    { currentValue: 100, targetValue: 100 },
    { currentValue: 25, targetValue: 100 },
  ];
  assert.equal(getObjectiveProgress(krs), 58);
});

test("Weekly task completions grouping is deterministic and bounded to 7 days", () => {
  const now = new Date("2026-09-27T12:00:00Z");
  const tasks = [
    { id: "1", updatedAt: "2026-09-27T10:00:00Z", columnTitle: "Concluído" },
    { id: "2", updatedAt: "2026-09-26T15:00:00Z", columnTitle: "Done" },
    { id: "3", updatedAt: "2026-09-15T10:00:00Z", columnTitle: "Concluído" },
    { id: "4", updatedAt: "2026-09-27T08:00:00Z", columnTitle: "Em Andamento" },
  ];

  const completedTasks = tasks.filter(t => t.columnTitle.toLowerCase().includes("conclu") || t.columnTitle.toLowerCase().includes("done"));

  const weeklyTrend = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
    const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

    const completions = completedTasks.filter(t => {
      if (!t.updatedAt) return false;
      const updated = new Date(t.updatedAt);
      return updated >= dayStart && updated <= dayEnd;
    }).length;

    return { completions };
  });

  assert.equal(weeklyTrend.length, 7);
  assert.equal(weeklyTrend[6].completions, 1);
  assert.equal(weeklyTrend[5].completions, 1);
  const totalWindow = weeklyTrend.reduce((acc, curr) => acc + curr.completions, 0);
  assert.equal(totalWindow, 2);
});
