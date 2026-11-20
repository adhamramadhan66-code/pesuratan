/* Sidebar: tertutup saat dibuka; menutup bila menu dipilih, area di luar sidebar ditekan, atau tombol Esc. */
(function () {
    const sb = document.getElementById('mainSidebar'), tg = document.getElementById('sidebarToggle');
    if (!sb || !tg) return;

    const bd = document.createElement('div');
    bd.className = 'sidebar-backdrop';
    document.body.appendChild(bd);

    const terbuka = () => sb.classList.contains('expanded');
    const sinkron = () => bd.classList.toggle('show', terbuka());
    const tutup = () => { if (terbuka()) tg.click(); };

    new MutationObserver(sinkron).observe(sb, { attributes: true, attributeFilter: ['class'] });
    bd.addEventListener('click', tutup);
    sb.querySelectorAll('a.nav-item').forEach((a) => a.addEventListener('click', tutup));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') tutup(); });
    sinkron();
})();
