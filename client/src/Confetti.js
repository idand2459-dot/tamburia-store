import { useEffect, useRef } from 'react';

function Confetti({ onDone }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#e63946', '#f4c430', '#25d366', '#1a1a2e', '#457b9d', '#f4a261', '#a8dadc'];
    const particles = Array.from({ length: 150 }, () => ({
      x: Math.random() * canvas.width,
      y: -20,
      w: Math.random() * 10 + 5,
      h: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      speedX: (Math.random() - 0.5) * 4,
      speedY: Math.random() * 4 + 2,
      speedR: (Math.random() - 0.5) * 6,
      opacity: 1,
    }));

    let frame;
    let startTime = Date.now();

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const elapsed = Date.now() - startTime;

      particles.forEach(p => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.rotation += p.speedR;
        if (elapsed > 2000) p.opacity = Math.max(0, p.opacity - 0.015);

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      if (elapsed < 3500) {
        frame = requestAnimationFrame(draw);
      } else {
        cancelAnimationFrame(frame);
        if (onDone) onDone();
      }
    }

    draw();
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        pointerEvents: 'none',
      }}
    />
  );
}

export default Confetti;