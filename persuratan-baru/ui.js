/* ui.js - pelengkap ui.css: transisi tema halus, riak klik, geser tepi kiri untuk menu di HP. */
(function () {
    'use strict';
    const html = document.documentElement;
    const kurangiGerak = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const tombolTema = document.getElementById('themeToggle');
    if (tombolTema) {
        tombolTema.addEventListener('click', () => {
            html.classList.add('ui-tema');
            clearTimeout(tombolTema._uiTmr);
            tombolTema._uiTmr = setTimeout(() => html.classList.remove('ui-tema'), 650);
        }, true);
    }

    const TARGET_RIAK = '.btn, .seg button, .ic-btn';   // menu sidebar & tombol buka/tutup sengaja tanpa riak
    document.addEventListener('pointerdown', (e) => {
        if (kurangiGerak || e.button > 0) return;
        const t = e.target.closest && e.target.closest(TARGET_RIAK);
        if (!t || t.disabled || t.getAttribute('aria-disabled') === 'true') return;
        const r = t.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.4;
        const wadah = document.createElement('ui-riak'), g = document.createElement('ui-g');
        g.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px';
        wadah.appendChild(g);
        if (getComputedStyle(t).position === 'static') t.style.position = 'relative';
        t.appendChild(wadah);
        g.addEventListener('animationend', () => wadah.remove());
        setTimeout(() => wadah.remove(), 1100);
    }, true);

    const tombolMenu = document.getElementById('sidebarToggle'), bar = document.getElementById('mainSidebar');
    if (tombolMenu && bar && 'ontouchstart' in window) {
        let awal = null;
        document.addEventListener('touchstart', (e) => {
            const t = e.touches[0]; if (!t || window.innerWidth > 768) { awal = null; return; }
            const terbuka = bar.classList.contains('expanded');
            awal = { x: t.clientX, y: t.clientY, sah: terbuka || t.clientX < 22 };
        }, { passive: true });
        document.addEventListener('touchend', (e) => {
            if (!awal || !awal.sah) return;
            const t = e.changedTouches[0]; if (!t) return;
            const dx = t.clientX - awal.x, dy = Math.abs(t.clientY - awal.y), buka = bar.classList.contains('expanded');
            if (dy < 60 && ((!buka && dx > 70) || (buka && dx < -70))) tombolMenu.click();
            awal = null;
        }, { passive: true });
    }
})();
