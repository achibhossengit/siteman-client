export const waitMs = (ms, isCancelled) =>
  new Promise((resolve) => {
    window.setTimeout(() => resolve(!isCancelled()), ms);
  });

export const waitForId = (id, isCancelled, timeoutMs = 5000) =>
  new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (isCancelled()) {
        resolve(null);
        return;
      }
      const el = document.getElementById(id);
      if (el) {
        resolve(el);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        resolve(null);
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });

const scrollParentOf = (el) => {
  let node = el.parentElement;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const canY =
      (style.overflowY === "auto" || style.overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight + 1;
    const canX =
      (style.overflowX === "auto" || style.overflowX === "scroll") &&
      node.scrollWidth > node.clientWidth + 1;
    if (canY || canX) return node;
    node = node.parentElement;
  }
  return document.scrollingElement || document.documentElement;
};

const scrollAxis = (scroller, el, axis) => {
  const s = scroller.getBoundingClientRect();
  const e = el.getBoundingClientRect();
  if (axis === "y") {
    const next =
      scroller.scrollTop + (e.top - s.top) - (s.height - e.height) / 2;
    scroller.scrollTo({ top: Math.max(0, next), behavior: "smooth" });
    return;
  }
  const next = scroller.scrollLeft + (e.right - s.right) + 8;
  scroller.scrollTo({ left: Math.max(0, next), behavior: "smooth" });
};

/** Row mark → vertical scroll → horizontal scroll → cell mark. */
export const playFocusTour = async (row, cell, isCancelled) => {
  row.classList.add("hajira-focus-row");
  const scroller = scrollParentOf(row);
  const label = row.querySelector("td") || row;
  scrollAxis(scroller, label, "y");
  if (!(await waitMs(500, isCancelled))) return false;
  scrollAxis(scroller, cell, "x");
  if (!(await waitMs(500, isCancelled))) return false;
  row.classList.remove("hajira-focus-row");
  cell.classList.add("hajira-focus-cell");
  return true;
};

/** Scroll to row → row mark → cell mark. */
export const playMotFocusTour = async (row, cell, isCancelled) => {
  const scroller = scrollParentOf(row);
  scrollAxis(scroller, row, "y");
  if (!(await waitMs(500, isCancelled))) return false;
  row.classList.add("hajira-focus-row");
  if (!(await waitMs(500, isCancelled))) return false;
  row.classList.remove("hajira-focus-row");
  cell.classList.add("hajira-focus-cell");
  return true;
};
