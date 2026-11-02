/* Local seasonal enhancement: no libraries or network requests. */
(() => {
  'use strict';
  if (window.KTHQHarvestCleanup) window.KTHQHarvestCleanup();
  const theme = document.getElementById('thanksgiving-theme') || document.getElementById('thanksgiving-preview');
  const themeToggle = document.getElementById('theme-toggle');
  const motionToggle = document.getElementById('leaves-toggle');
  const canvas = document.getElementById('harvest-leaves');
  const hero = document.getElementById('home') || document.getElementById('trainingSeason');
  const isTraining = hero?.id === 'trainingSeason';
  if (!canvas || !hero) return;
  let disposed = false;
  let resizeObserver;
  let visibilityObserver;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let seasonal = true;
  let paused = reducedMotion.matches;
  let visible = true;
  let frame = 0;
  let previous = 0;
  let width = 0;
  let height = 0;
  let leaves = [];
  let wind = 0;
  let breeze = 0;
  themeToggle?.addEventListener('click', () => {
    seasonal = !seasonal;
    theme.disabled = !seasonal;
    document.querySelectorAll('.seasonal').forEach(el => { el.hidden = !seasonal; });
    themeToggle.textContent = seasonal ? 'Standard colors' : 'Thanksgiving colors';
    themeToggle.setAttribute('aria-pressed', String(seasonal));
    if (motionToggle) motionToggle.hidden = !seasonal;
    resize();
    syncMotion();
  });
  motionToggle?.addEventListener('click', () => { paused = !paused; syncMotion(); });
  function onMotionPreference() { paused = reducedMotion.matches; syncMotion(); }
  reducedMotion.addEventListener('change', onMotionPreference);
  document.addEventListener('visibilitychange', syncMotion);
  const ctx = canvas.getContext('2d');
  // Two leaf silhouettes, with their own stems and veins. No emoji glyphs.
  const shapes = [
    new Path2D('M0 15 L-2 6 L-12 8 L-9 2 L-19 -2 L-12 -7 L-14 -15 L-5 -11 L0 -25 L5 -11 L14 -15 L12 -7 L19 -2 L9 2 L12 8 L2 6 Z'),
    new Path2D('M0 16 C-3 10 -12 10 -9 4 C-20 2 -17 -5 -10 -5 C-18 -13 -9 -18 -5 -14 C-6 -28 7 -28 5 -14 C13 -20 18 -11 10 -5 C20 -3 17 5 9 4 C13 10 3 12 0 16 Z')
  ];
  const colors = ['#cb8747','#c25b34','#d8ad64','#9b5831','#d2a36b'];
  function makeLeaf(scatter) {
    return { x: Math.random()*width, y: scatter ? Math.random()*height : -45,
      size: .24 + Math.random()*.45, speed: 16+Math.random()*19,
      angle: Math.random()*Math.PI*2, spin: (Math.random()-.5)*.65,
      phase: Math.random()*Math.PI*2, color: colors[Math.floor(Math.random()*colors.length)],
      alpha: .24+Math.random()*.32, shape: Math.floor(Math.random()*shapes.length) };
  }
  function resize() {
    if (!ctx) return;
    width = hero.clientWidth;
    height = hero.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    canvas.width = Math.round(width*dpr);
    canvas.height = Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    leaves = Array.from({ length: isTraining ? (width < 680 ? 6 : 12) : (width < 680 ? 11 : 23) }, () => makeLeaf(true));
  }
  let lastDraw = 0;
  function draw(now) {
    if (disposed || !hero.isConnected) return;
    if (now - lastDraw < 1000 / 24) { frame = requestAnimationFrame(draw); return; }
    lastDraw = now;
    const dt = Math.min((now-previous)/1000 || 0, .05);
    previous = now;
    ctx.clearRect(0,0,width,height);
    breeze = Math.max(0,breeze-dt*.5);
    leaves.forEach(leaf => {
      leaf.y += leaf.speed*dt;
      leaf.x += (Math.sin(now*.00035+leaf.phase)*14+wind*10+breeze*75)*dt;
      leaf.angle += leaf.spin*dt;
      if (leaf.y > height+50) Object.assign(leaf,makeLeaf(false));
      if (leaf.x > width+45) leaf.x = -35;
      if (leaf.x < -45) leaf.x = width+35;
      ctx.save();
      ctx.translate(leaf.x+Math.sin(now*.0007+leaf.phase)*20,leaf.y);
      ctx.rotate(leaf.angle);
      ctx.scale(leaf.size*(.4+.6*Math.abs(Math.cos(now*.00065+leaf.phase))),leaf.size);
      // Dim leaves over the reading area, keep the edges a little brighter.
      ctx.globalAlpha = leaf.alpha * (leaf.x > width*.15 && leaf.x < width*.67 ? .4 : 1);
      ctx.fillStyle = leaf.color;
      ctx.fill(shapes[leaf.shape]);
      ctx.strokeStyle = '#f5d3a0';
      ctx.lineWidth = .7;
      ctx.globalAlpha *= .65;
      ctx.beginPath();ctx.moveTo(0,23);ctx.lineTo(0,-17);ctx.moveTo(0,1);ctx.lineTo(-8,-6);ctx.moveTo(0,-5);ctx.lineTo(7,-11);ctx.stroke();
      ctx.restore();
    });
    frame = requestAnimationFrame(draw);
  }
  function syncMotion() {
    if (disposed) return;
    cancelAnimationFrame(frame);
    frame = 0;
    const allowed = seasonal && !paused && !reducedMotion.matches;
    canvas.hidden = !allowed;
    if (motionToggle) {
    motionToggle.disabled = reducedMotion.matches || !ctx;
    motionToggle.textContent = reducedMotion.matches ? 'Motion off' : paused ? 'Resume leaves' : 'Pause leaves';
    motionToggle.setAttribute('aria-pressed', String(allowed));
    motionToggle.setAttribute('aria-label', reducedMotion.matches ? 'Animation disabled by your reduced motion preference' : paused ? 'Resume falling leaves' : 'Pause falling leaves');
    }
    if (ctx && allowed && visible && !document.hidden) { previous = 0; frame = requestAnimationFrame(draw); }
  }
  const artScene = document.querySelector('.harvest-scene');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  artScene?.addEventListener('pointermove', event => {
    if (reducedMotion.matches || paused || !finePointer.matches) return;
    const bounds = artScene.getBoundingClientRect();
    artScene.style.setProperty('--art-turn', ((event.clientX - bounds.left) / bounds.width - .5) * 5 + 'deg');
    artScene.style.setProperty('--art-rise', ((event.clientY - bounds.top) / bounds.height - .5) * -4 + 'deg');
  }, {passive:true});
  artScene?.addEventListener('pointerleave', () => {
    artScene.style.setProperty('--art-turn', '0deg');
    artScene.style.setProperty('--art-rise', '0deg');
  });
  if (!isTraining) hero.addEventListener('pointermove', event => { wind = (event.clientX/Math.max(width,1)-.5)*2; }, {passive:true});
  hero.addEventListener('pointerleave', () => { wind = 0; });
  if ('ResizeObserver' in window) { resizeObserver = new ResizeObserver(resize); resizeObserver.observe(hero); }
  else window.addEventListener('resize',resize,{passive:true});
  if ('IntersectionObserver' in window) { visibilityObserver = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    syncMotion();
  }); visibilityObserver.observe(hero); }
  const pageObserver = new MutationObserver(() => { if (!hero.isConnected) cleanup(); });
  function cleanup() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    resizeObserver?.disconnect();
    visibilityObserver?.disconnect();
    pageObserver.disconnect();
    document.removeEventListener('visibilitychange', syncMotion);
    reducedMotion.removeEventListener('change', onMotionPreference);
    window.removeEventListener('resize', resize);
    if (window.KTHQHarvestCleanup === cleanup) delete window.KTHQHarvestCleanup;
  }
  window.KTHQHarvestCleanup = cleanup;
  pageObserver.observe(document.body, {childList:true});
  resize();
  syncMotion();
})();
