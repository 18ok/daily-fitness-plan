function validHistory(history) {
  return Array.isArray(history) ? history.filter((entry) => entry?.date) : [];
}

export function upsertDailyPlan(history, record) {
  return [...validHistory(history).filter((entry) => entry.date !== record.date), record].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

export function samePlanSelections(left, right) {
  if (!left || !right) return false;
  return left.time === right.time && left.status === right.status && left.condition === right.condition;
}
