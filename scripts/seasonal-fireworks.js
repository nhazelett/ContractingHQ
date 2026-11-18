/* Draw-only New Year fireworks. The seasonal controller owns timing and accessibility. */
((root, factory) => {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KTHQSeasonFireworks = api;
})(typeof window === 'undefined' ? null : window, () => {
  'use strict';
  const palettes = [
    ['#fff0be', '#ffd477', '#f2b74e', '#ffe5a0'],
    ['#e4f7ff', '#b9e4ff', '#86c9ff', '#d4eeff'],
    ['#f0deff', '#d1b5ff', '#af91f0', '#e6caff']
  ];
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const random = (low, high) => low + Math.random() * (high - low);
  const smooth = (low, high, value) => {
    const t = clamp((value - low) / (high - low), 0, 1);
    return t * t * (3 - 2 * t);
  };

  function create(ctx) {
    let width = 0;
    let height = 0;
    let stageHeight = 0;
    let narrow = false;
    let sparkLimit = 240;
    let rocketLimit = 3;
    let sparks = [];
    let rockets = [];
    let elapsed = 0;
    let nextLaunch = .35;
    let launchIndex = 0;
    let started = false;

    function reset() {
      sparks = [];
      rockets = [];
      elapsed = 0;
      nextLaunch = .35;
      launchIndex = 0;
      started = false;
    }

    function resize(nextWidth, nextHeight) {
      const w = Number.isFinite(nextWidth) ? Math.max(0, nextWidth) : 0;
      const h = Number.isFinite(nextHeight) ? Math.max(0, nextHeight) : 0;
      if (w === width && h === height) return;
      width = w;
      height = h;
      narrow = width < 680;
      stageHeight = Math.min(height, narrow ? 560 : 800);
      sparkLimit = narrow ? 110 : 240;
      rocketLimit = narrow ? 2 : 3;
      reset();
    }

    function target(index) {
      // Keep the largest blooms above and to the right of the main reading area.
      const zones = narrow
        ? [[.72, .22], [.26, .35], [.55, .17], [.79, .40]]
        : [[.79, .20], [.55, .30], [.90, .35], [.30, .13], [.69, .25]];
      const zone = zones[index % zones.length];
      return {
        x: width * clamp(zone[0] + random(-.025, .025), .12, .92),
        y: stageHeight * zone[1],
        palette: index % palettes.length
      };
    }

    function burst(location, initialAge = 0) {
      const count = Math.min(narrow ? 42 : 76, sparkLimit - sparks.length);
      if (count < 12) return;
      const colors = palettes[location.palette];
      const speed = narrow ? clamp(width * .32, 90, 160) : clamp(width * .15, 165, 235);
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 + random(-.025, .025);
        const velocity = speed * (i % 4 === 0 ? random(.36, .62) : random(.78, 1.08));
        sparks.push({
          x: location.x, y: location.y,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity * .92,
          age: initialAge,
          life: narrow ? random(2.1, 2.75) : random(2.5, 3.25),
          drag: random(.9, 1.2), gravity: random(23, 35),
          size: random(.85, 1.55), color: colors[i % colors.length]
        });
      }
    }

    function launch() {
      if (rockets.length >= rocketLimit) return;
      launchIndex += 1;
      const destination = target(launchIndex);
      rockets.push({
        x: clamp(destination.x + random(-45, 45), width * .08, width * .95),
        y: stageHeight * random(.77, .94),
        target: destination, age: 0, life: random(.75, 1.05),
        bend: random(-18, 18)
      });
    }

    function point(spark, age) {
      const travel = (1 - Math.exp(-spark.drag * age)) / spark.drag;
      return {
        x: spark.x + spark.vx * travel,
        y: spark.y + spark.vy * travel + spark.gravity * age * age * .5
      };
    }

    function rocketPoint(rocket, age) {
      const t = clamp(age / rocket.life, 0, 1);
      const ascent = 1 - (1 - t) * (1 - t);
      return {
        x: rocket.x + (rocket.target.x - rocket.x) * t + Math.sin(t * Math.PI) * rocket.bend,
        y: rocket.y + (rocket.target.y - rocket.y) * ascent
      };
    }

    function visibility(x, y) {
      if (narrow) return 1 - .45 * smooth(stageHeight * .5, stageHeight * .9, y);
      const readingArea = (1 - smooth(width * .49, width * .67, x)) *
        smooth(stageHeight * .18, stageHeight * .36, y);
      return 1 - .55 * readingArea;
    }

    function drawSpark(spark) {
      const head = point(spark, spark.age);
      if (head.x < -20 || head.x > width + 20 || head.y < -20 || head.y > stageHeight + 20) return;
      const fade = Math.pow(Math.max(0, 1 - spark.age / spark.life), 1.25);
      const alpha = fade * visibility(head.x, head.y);
      const middle = point(spark, Math.max(0, spark.age - .06));
      const tail = point(spark, Math.max(0, spark.age - .15));

      // A quiet wide glow, a crisp curved trail, and a bright tip. No flashing fill.
      ctx.strokeStyle = spark.color;
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.quadraticCurveTo(middle.x, middle.y, head.x, head.y);
      ctx.globalAlpha = alpha * .075;
      ctx.lineWidth = spark.size * 4.6;
      ctx.stroke();
      ctx.globalAlpha = alpha * .86;
      ctx.lineWidth = spark.size;
      ctx.stroke();
      ctx.fillStyle = spark.color;
      ctx.globalAlpha = alpha * .95;
      ctx.beginPath();
      ctx.arc(head.x, head.y, spark.size * (.55 + fade * .35), 0, Math.PI * 2);
      ctx.fill();
    }

    function drawRocket(rocket) {
      const head = rocketPoint(rocket, rocket.age);
      const tail = rocketPoint(rocket, Math.max(0, rocket.age - .19));
      const middle = rocketPoint(rocket, Math.max(0, rocket.age - .09));
      const alpha = visibility(head.x, head.y);
      ctx.strokeStyle = '#ffdda0';
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.quadraticCurveTo(middle.x, middle.y, head.x, head.y);
      ctx.globalAlpha = alpha * .1;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.globalAlpha = alpha * .72;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = '#fff1ca';
      ctx.beginPath();
      ctx.arc(head.x, head.y, 1.9, 0, Math.PI * 2);
      ctx.fill();
    }

    function draw(now, dt) {
      if (!ctx || width <= 0 || height <= 0) return;
      if (!started) {
        started = true;
        burst(target(0), .43); // The first frame already contains a recognizable bloom.
      }
      // Only active drawing time advances the show, never wall-clock time after a pause.
      const step = Number.isFinite(dt) ? clamp(dt, 0, .06) : 0;
      elapsed += step;
      sparks.forEach(spark => { spark.age += step; });
      sparks = sparks.filter(spark => spark.age < spark.life);
      const pending = [];
      rockets.forEach(rocket => {
        rocket.age += step;
        if (rocket.age >= rocket.life) burst(rocket.target);
        else pending.push(rocket);
      });
      rockets = pending;
      if (elapsed >= nextLaunch) {
        launch();
        nextLaunch = elapsed + (narrow ? random(1.55, 2.2) : random(1.1, 1.7));
      }

      ctx.save();
      try {
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.shadowBlur = 0;
        sparks.forEach(drawSpark);
        rockets.forEach(drawRocket);
      } finally {
        ctx.restore();
      }
    }

    return Object.freeze({ resize, draw, reset });
  }

  return Object.freeze({ create });
});
