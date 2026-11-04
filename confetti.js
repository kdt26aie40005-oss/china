// 紙吹雪（昇級したときの演出）
// launchConfetti({ count, colors }) で、画面の左右から紙吹雪を飛ばす。
// ほかのファイルからも呼べるように、ほかの関数には依存しない。

function launchConfetti({ count = 140, colors = ["#e74c3c", "#f1c40f", "#2ecc71", "#3498db", "#9b59b6"] } = {}) {
  // 「視差効果を減らす」設定の人には少なめに
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) count = Math.round(count / 4);

  const canvas = document.createElement("canvas");
  canvas.className = "confetti-canvas";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const pieces = Array.from({ length: count }, (_, i) => {
    const fromLeft = i % 2 === 0;
    const angle = (Math.random() * 35 + 40) * (Math.PI / 180); // 斜め上に向かって飛ばす
    const speed = Math.random() * 9 + 9;
    return {
      x: fromLeft ? -10 : w + 10,
      y: h * (0.55 + Math.random() * 0.25),
      vx: Math.cos(angle) * speed * (fromLeft ? 1 : -1) * (w / 900 + 0.4),
      vy: -Math.sin(angle) * speed * (h / 800 + 0.4),
      size: Math.random() * 6 + 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      spin: Math.random() * Math.PI,
      spinSpeed: (Math.random() - 0.5) * 0.3,
      flutter: Math.random() * Math.PI * 2,
      delay: Math.random() * 18, // 少しずつ時間をずらして飛び出す
    };
  });

  let frame = 0;
  function draw() {
    frame++;
    ctx.clearRect(0, 0, w, h);
    let alive = 0;
    for (const p of pieces) {
      if (frame < p.delay) {
        alive++;
        continue;
      }
      p.vx *= 0.985;
      p.vy = p.vy * 0.985 + 0.28; // 重力
      p.flutter += 0.12;
      p.x += p.vx + Math.sin(p.flutter) * 0.8;
      p.y += p.vy;
      p.spin += p.spinSpeed;
      if (p.y > h + 20) continue;
      alive++;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.scale(1, Math.abs(Math.cos(p.flutter))); // ひらひら裏返る
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (alive > 0 && frame < 600) {
      requestAnimationFrame(draw);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(draw);
}
