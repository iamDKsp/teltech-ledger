import { useEffect, useRef } from "react";

export function Loader({ isReady, onFinish }: { isReady: boolean, onFinish: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isReadyRef = useRef(isReady);
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Configurações da animação
    const LOOP_TIME = 5200; // Tempo total do loop em ms aumentado
    const LOGO_WIDTH = 190;
    const LOGO_HEIGHT = 140;

    // Definição das peças geométricas que compõem a logo
    const pieces = [
      { x: 0, y: 40, w: 80, h: 20, type: "width", startIn: 0, endIn: 400, startOut: 3000, endOut: 3400 },
      { x: 80, y: 0, w: 20, h: 140, type: "height", startIn: 400, endIn: 800, startOut: 3400, endOut: 3800 },
      { x: 110, y: 20, w: 20, h: 20, type: "scale", startIn: 600, endIn: 900, startOut: 3600, endOut: 3900 },
      { x: 110, y: 60, w: 20, h: 80, type: "height", startIn: 800, endIn: 1200, startOut: 3800, endOut: 4200 },
      { x: 130, y: 120, w: 60, h: 20, type: "width", startIn: 1200, endIn: 1600, startOut: 4200, endOut: 4600 },
    ];

    const startTime = Date.now();
    let animationFrameId: number;
    let finished = false;
    let lastLoop = 0;

    function easeInOutCubic(t: number) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function getProgress(time: number, start: number, end: number) {
      if (time <= start) return 0;
      if (time >= end) return 1;
      const p = (time - start) / (end - start);
      return easeInOutCubic(p);
    }

    let logicalWidth = canvas.parentElement?.clientWidth || window.innerWidth;
    let logicalHeight = canvas.parentElement?.clientHeight || window.innerHeight;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!canvas) return;
      for (let entry of entries) {
        logicalWidth = entry.contentRect.width;
        logicalHeight = entry.contentRect.height;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = logicalWidth * dpr;
        canvas.height = logicalHeight * dpr;
        canvas.style.width = `${logicalWidth}px`;
        canvas.style.height = `${logicalHeight}px`;
      }
    });

    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    function draw() {
      if (!ctx || !canvas || finished) return;
      
      const elapsed = Date.now() - startTime;
      const currentLoop = Math.floor(elapsed / LOOP_TIME);
      const timeMs = elapsed % LOOP_TIME;

      // Liberar instantaneamente assim que os dados estiverem prontos (mínimo de 180ms para evitar flash)
      if (isReadyRef.current && (elapsed >= 180 || currentLoop > lastLoop)) {
        finished = true;
        onFinishRef.current();
        return;
      }
      lastLoop = currentLoop;

      if (logicalWidth === 0 || logicalHeight === 0) {
        animationFrameId = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let scale = Math.min(logicalWidth / 400, logicalHeight / 300);
      if (scale > 2) scale = 2;

      ctx.save();
      const dpr = window.devicePixelRatio || 1;
      ctx.scale(dpr, dpr);
      ctx.translate(logicalWidth / 2 - (LOGO_WIDTH * scale) / 2, logicalHeight / 2 - (LOGO_HEIGHT * scale) / 2);
      ctx.scale(scale, scale);

      const grad = ctx.createLinearGradient(0, 0, LOGO_WIDTH, 0);
      grad.addColorStop(0, "#c224ff");
      grad.addColorStop(0.5, "#407bff");
      grad.addColorStop(1, "#00e5ff");
      ctx.fillStyle = grad;

      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 4;
      ctx.shadowOffsetY = 4;

      pieces.forEach(p => {
        const pIn = getProgress(timeMs, p.startIn, p.endIn);
        const pOut = getProgress(timeMs, p.startOut, p.endOut);
        if (pIn === 0) return;

        ctx.beginPath();
        if (p.type === "width") {
          ctx.rect(p.x + (p.w * pOut), p.y, p.w * (pIn - pOut), p.h);
        } else if (p.type === "height") {
          ctx.rect(p.x, p.y + (p.h * pOut), p.w, p.h * (pIn - pOut));
        } else if (p.type === "scale") {
          const s = pIn - pOut;
          ctx.rect((p.x + p.w / 2) - (p.w / 2) * s, (p.y + p.h / 2) - (p.h / 2) * s, p.w * s, p.h * s);
        }
        ctx.fill();
      });

      const shimmerP = getProgress(timeMs, 1600, 2900);
      if (shimmerP > 0 && shimmerP < 1) {
        ctx.globalCompositeOperation = "source-atop";
        const sx = -150 + (LOGO_WIDTH + 300) * shimmerP;
        const shimmerGrad = ctx.createLinearGradient(sx, 0, sx + 150, 50);
        shimmerGrad.addColorStop(0, "rgba(255,255,255,0)");
        shimmerGrad.addColorStop(0.5, "rgba(255,255,255,0.35)");
        shimmerGrad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.shadowColor = "transparent";
        ctx.fillStyle = shimmerGrad;
        ctx.fillRect(0, 0, LOGO_WIDTH, LOGO_HEIGHT);
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      if (canvas.parentElement) {
        resizeObserver.unobserve(canvas.parentElement);
      }
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div style={{
      width: "100%", height: "100%", minHeight: "100%",
      backgroundColor: "transparent", overflow: "hidden",
      display: "flex", justifyContent: "center", alignItems: "center"
    }}>
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}
