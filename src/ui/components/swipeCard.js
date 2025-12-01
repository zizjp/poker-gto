export function attachSwipeCard(el, options) {
    let startX = 0;
    let startY = 0;
    let isTouching = false;
    const threshold = 40; // px
    el.addEventListener("touchstart", (ev) => {
        const t = ev.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        isTouching = true;
    }, { passive: true });
    el.addEventListener("touchend", (ev) => {
        if (!isTouching)
            return;
        isTouching = false;
        const t = ev.changedTouches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
            options.onSwipe("TAP");
            return;
        }
        if (Math.abs(dx) > Math.abs(dy)) {
            options.onSwipe(dx > 0 ? "RIGHT" : "LEFT");
        }
        else {
            options.onSwipe(dy < 0 ? "UP" : "DOWN");
        }
    }, { passive: true });
}
