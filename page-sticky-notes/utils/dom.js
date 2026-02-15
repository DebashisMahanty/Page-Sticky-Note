export function clampPosition(position = {}, viewport = getViewportBounds()) {
  const defaultX = Math.max(16, viewport.width - 332);
  const safeX = Number.isFinite(position.x) ? position.x : defaultX;
  const safeY = Number.isFinite(position.y) ? position.y : 96;

  return {
    x: Math.min(Math.max(8, safeX), Math.max(8, viewport.width - 24)),
    y: Math.min(Math.max(8, safeY), Math.max(8, viewport.height - 24))
  };
}

export function getViewportBounds() {
  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
}

export function debounce(fn, delay = 300) {
  let timeout = null;
  return (...args) => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => fn(...args), delay);
  };
}
