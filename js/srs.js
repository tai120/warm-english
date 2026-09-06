/* ============================================================
   智能间隔复习（简化版 SM-2 记忆算法）
   - 忘记了：10 分钟后重新复习
   - 模糊：明天再复习
   - 认识：间隔逐渐拉长（1天 → 3天 → 6天 → 12天……）
   ============================================================ */
const DAY = 24 * 60 * 60 * 1000;

function schedule(item, grade) {
  const s = item.srs;
  s.seen = (s.seen || 0) + 1;
  if (grade === 'again') {
    s.n = 0; s.interval = 0; s.due = Date.now() + 10 * 60 * 1000;
    s.ef = Math.max(1.3, (s.ef || 2.5) - 0.2);
  } else if (grade === 'hard') {
    s.n = 0; s.interval = 1; s.due = Date.now() + DAY;
    s.ef = Math.max(1.3, (s.ef || 2.5) - 0.15);
  } else { /* good */
    s.n = (s.n || 0) + 1;
    s.interval = s.n === 1 ? 1 : s.n === 2 ? 3 : Math.round((s.interval || 3) * (s.ef || 2.5));
    s.due = Date.now() + s.interval * DAY;
    s.ef = Math.min(2.5, (s.ef || 2.5) + 0.1);
    s.ok = (s.ok || 0) + 1;
  }
}
