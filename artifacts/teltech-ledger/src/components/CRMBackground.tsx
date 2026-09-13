import { useEffect, useRef } from "react";

export function CRMBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const colors = {
      windowBg: "rgba(26, 26, 32, 0.65)",
      windowBorder: "rgba(123, 66, 246, 0.3)",
      columnBg: "rgba(35, 35, 42, 0.4)",
      cardBg: "rgba(45, 45, 53, 0.95)",
      textGhost: "rgba(255, 255, 255, 0.15)",
      tagPurple: "#7B42F6",
      tagGold: "#D97706",
      tagGreen: "#059669",
      glowPurple: "rgba(123, 66, 246, 0.15)",
      glowGreen: "rgba(52, 211, 153, 0.08)",
    };
    const tagColors = [colors.tagPurple, colors.tagGold, colors.tagGreen, colors.tagPurple];

    let width = 0, height = 0, time = 0;
    let mouseX = window.innerWidth / 2;
    let currentLeftBlur = 0, currentRightBlur = 0;

    const winConfig = { width: 480, height: 350, radius: 14, headerHeight: 32 };
    const colsConfig = { count: 3, padding: 16, gap: 16, yOffset: 48 };
    const cardConfig = { height: 60, gap: 12, radius: 6 };
    const colWidth = (winConfig.width - colsConfig.padding * 2 - colsConfig.gap * (colsConfig.count - 1)) / colsConfig.count;

    function resize() {
      if (!canvas || !ctx) return;
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      mouseX = width / 2;
    }

    class Card {
      id: number; colIndex: number; rowIndex: number; tagColor: string;
      x: number; y: number; targetX: number; targetY: number;
      textWidth1: number; textWidth2: number;
      isDragging: boolean; scale: number; targetScale: number;
      constructor(id: number, colIndex: number, rowIndex: number) {
        this.id = id; this.colIndex = colIndex; this.rowIndex = rowIndex;
        this.tagColor = tagColors[Math.floor(Math.random() * tagColors.length)];
        this.x = 0; this.y = 0; this.targetX = 0; this.targetY = 0;
        this.textWidth1 = 40 + Math.random() * 30;
        this.textWidth2 = 60 + Math.random() * 50;
        this.isDragging = false; this.scale = 1; this.targetScale = 1;
      }
      updateTargets(colX: number, startY: number) {
        this.targetX = colX;
        this.targetY = startY + this.rowIndex * (cardConfig.height + cardConfig.gap);
        if (this.x === 0) { this.x = this.targetX; this.y = this.targetY; }
      }
      update() {
        if (!this.isDragging) {
          this.x += (this.targetX - this.x) * 0.04;
          this.y += (this.targetY - this.y) * 0.04;
        }
        this.scale += (this.targetScale - this.scale) * 0.1;
      }
      draw(c: CanvasRenderingContext2D) {
        c.save();
        c.translate(this.x + colWidth / 2, this.y + cardConfig.height / 2);
        c.scale(this.scale, this.scale);
        c.translate(-(this.x + colWidth / 2), -(this.y + cardConfig.height / 2));
        if (this.isDragging) { c.shadowColor = "rgba(0,0,0,0.5)"; c.shadowBlur = 20; c.shadowOffsetY = 10; }
        c.fillStyle = colors.cardBg;
        c.beginPath(); (c as any).roundRect(this.x, this.y, colWidth, cardConfig.height, cardConfig.radius); c.fill();
        c.shadowColor = "transparent";
        c.fillStyle = this.tagColor;
        c.beginPath(); (c as any).roundRect(this.x + 12, this.y + 12, 35, 12, 4); c.fill();
        c.fillStyle = colors.textGhost;
        c.beginPath(); (c as any).roundRect(this.x + 12, this.y + 35, this.textWidth2, 5, 2); c.fill();
        c.beginPath(); (c as any).roundRect(this.x + 12, this.y + 47, this.textWidth1, 5, 2); c.fill();
        c.beginPath(); c.arc(this.x + colWidth - 20, this.y + cardConfig.height - 20, 8, 0, Math.PI * 2); c.fill();
        c.restore();
      }
    }

    class BaseCursor {
      x: number; y: number; targetX: number; targetY: number; scale: number;
      pulses: { x: number; y: number; radius: number; alpha: number }[];
      constructor() {
        this.x = winConfig.width / 2; this.y = winConfig.height / 2;
        this.targetX = this.x; this.targetY = this.y;
        this.scale = 1; this.pulses = [];
      }
      addPulse() { this.pulses.push({ x: this.x, y: this.y, radius: 2, alpha: 0.6 }); }
      updatePulses(dt: number) {
        for (let i = this.pulses.length - 1; i >= 0; i--) {
          const p = this.pulses[i];
          p.radius += 0.06 * dt; p.alpha -= 0.0025 * dt;
          if (p.alpha <= 0) this.pulses.splice(i, 1);
        }
      }
      draw(c: CanvasRenderingContext2D) {
        c.save();
        this.pulses.forEach(p => {
          c.beginPath(); c.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          c.strokeStyle = `rgba(255,255,255,${Math.max(0, p.alpha)})`; c.lineWidth = 2.5; c.stroke();
        });
        c.restore();
        c.save();
        c.translate(this.x, this.y); c.scale(this.scale, this.scale);
        c.shadowColor = "rgba(0,0,0,0.3)"; c.shadowBlur = 12; c.shadowOffsetY = 6; c.shadowOffsetX = 2;
        c.beginPath();
        c.moveTo(3, 3); c.lineTo(3, 32); c.quadraticCurveTo(14, 22, 28, 18); c.closePath();
        c.fillStyle = "#000000"; c.fill();
        c.shadowColor = "transparent"; c.lineWidth = 4.5; c.strokeStyle = "#ffffff";
        c.lineJoin = "round"; c.lineCap = "round"; c.stroke();
        c.restore();
      }
    }

    function recalculateIndices(cards: Card[]) {
      for (let c = 0; c < colsConfig.count; c++) {
        const inCol = cards.filter(card => card.colIndex === c);
        inCol.sort((a, b) => a.y - b.y);
        inCol.forEach((card, i) => { card.rowIndex = i; });
      }
    }

    class DragDropCursor extends BaseCursor {
      state: string; card: Card | null; timer: number; clickOffsetX: number; clickOffsetY: number;
      constructor() {
        super(); this.state = "IDLE"; this.card = null; this.timer = 1000;
        this.clickOffsetX = 0; this.clickOffsetY = 0;
      }
      update(dt: number, app: { cards: Card[]; cursor: DragDropCursor }) {
        this.x += (this.targetX - this.x) * 0.03; this.y += (this.targetY - this.y) * 0.03;
        this.updatePulses(dt);
        switch (this.state) {
          case "IDLE":
            this.timer -= dt;
            if (this.timer <= 0) {
              const lastColCards = app.cards.filter(c => c.colIndex === colsConfig.count - 1);
              if (lastColCards.length > 3) {
                const toRecycle = lastColCards.sort((a, b) => b.rowIndex - a.rowIndex)[0];
                toRecycle.colIndex = 0; toRecycle.y = winConfig.height + 200;
                recalculateIndices(app.cards);
              }
              const movable = app.cards.filter(c => c.colIndex < colsConfig.count - 1);
              if (movable.length === 0) return;
              this.card = movable[Math.floor(Math.random() * movable.length)];
              this.state = "MOVING";
              this.clickOffsetX = colWidth / 2 + (Math.random() * 20 - 10);
              this.clickOffsetY = cardConfig.height / 2 + (Math.random() * 10 - 5);
            }
            break;
          case "MOVING":
            this.targetX = this.card!.x + this.clickOffsetX; this.targetY = this.card!.y + this.clickOffsetY;
            if (Math.hypot(this.targetX - this.x, this.targetY - this.y) < 5) {
              this.state = "GRABBING"; this.timer = 400; this.scale = 0.85; this.addPulse();
            }
            break;
          case "GRABBING":
            this.targetX = this.card!.x + this.clickOffsetX; this.targetY = this.card!.y + this.clickOffsetY;
            this.timer -= dt;
            if (this.timer <= 0) {
              this.card!.isDragging = true; this.card!.targetScale = 1.05;
              this.card!.colIndex += 1; recalculateIndices(app.cards); this.state = "DRAGGING";
            }
            break;
          case "DRAGGING": {
            const dColX = colsConfig.padding + this.card!.colIndex * (colWidth + colsConfig.gap);
            const dColY = colsConfig.yOffset + 45 + this.card!.rowIndex * (cardConfig.height + cardConfig.gap);
            this.targetX = dColX + this.clickOffsetX; this.targetY = dColY + this.clickOffsetY;
            this.card!.x = this.x - this.clickOffsetX; this.card!.y = this.y - this.clickOffsetY;
            this.card!.targetX = dColX; this.card!.targetY = dColY;
            if (Math.hypot(this.targetX - this.x, this.targetY - this.y) < 5) {
              this.state = "DROPPING"; this.timer = 300;
              this.card!.isDragging = false; this.card!.targetScale = 1; this.scale = 1;
            }
            break;
          }
          case "DROPPING":
            this.timer -= dt;
            if (this.timer <= 0) {
              this.state = "IDLE"; this.timer = 2000 + Math.random() * 1000; this.card = null;
              this.targetX += (Math.random() - 0.5) * 150; this.targetY += (Math.random() - 0.5) * 150;
            }
            break;
        }
      }
    }

    interface Modal { isOpen: boolean; progress: number; sourceCard: Card | null; toggleState: boolean; }
    class ModalCursor extends BaseCursor {
      state: string; card: Card | null; timer: number;
      modalW: number; modalH: number; modalX: number; modalY: number;
      toggleX: number; toggleY: number; closeX: number; closeY: number;
      constructor() {
        super(); this.state = "IDLE"; this.card = null; this.timer = 1500;
        this.modalW = winConfig.width * 0.68; this.modalH = winConfig.height * 0.68;
        this.modalX = (winConfig.width - this.modalW) / 2; this.modalY = (winConfig.height - this.modalH) / 2;
        this.toggleX = this.modalX + this.modalW - 50; this.toggleY = this.modalY + 50;
        this.closeX = this.modalX + 16; this.closeY = this.modalY + 16;
      }
      update(dt: number, app: { cards: Card[]; cursor: ModalCursor; modal: Modal }) {
        this.x += (this.targetX - this.x) * 0.035; this.y += (this.targetY - this.y) * 0.035;
        this.updatePulses(dt);
        switch (this.state) {
          case "IDLE":
            this.timer -= dt;
            if (this.timer <= 0 && app.modal.progress < 0.01) {
              this.card = app.cards[Math.floor(Math.random() * app.cards.length)];
              this.state = "MOVE_TO_CARD";
            }
            break;
          case "MOVE_TO_CARD":
            this.targetX = this.card!.x + colWidth / 2; this.targetY = this.card!.y + cardConfig.height / 2;
            if (Math.hypot(this.targetX - this.x, this.targetY - this.y) < 5) {
              this.state = "CLICK_CARD"; this.timer = 300; this.scale = 0.85; this.addPulse();
            }
            break;
          case "CLICK_CARD":
            this.targetX = this.card!.x + colWidth / 2; this.targetY = this.card!.y + cardConfig.height / 2;
            this.timer -= dt;
            if (this.timer <= 0) {
              app.modal.isOpen = true; app.modal.sourceCard = this.card;
              this.state = "WAIT_MODAL"; this.scale = 1; this.timer = 600;
            }
            break;
          case "WAIT_MODAL":
            this.timer -= dt;
            if (this.timer <= 0 && app.modal.progress > 0.95) this.state = "MOVE_TO_TOGGLE";
            break;
          case "MOVE_TO_TOGGLE":
            this.targetX = this.toggleX + 20; this.targetY = this.toggleY + 12;
            if (Math.hypot(this.targetX - this.x, this.targetY - this.y) < 5) {
              this.state = "CLICK_TOGGLE"; this.timer = 300; this.scale = 0.85; this.addPulse();
            }
            break;
          case "CLICK_TOGGLE":
            this.timer -= dt;
            if (this.timer <= 0) {
              app.modal.toggleState = !app.modal.toggleState;
              this.state = "WAIT_TOGGLE"; this.scale = 1; this.timer = 800;
            }
            break;
          case "WAIT_TOGGLE":
            this.timer -= dt;
            if (this.timer <= 0) this.state = "MOVE_TO_CLOSE";
            break;
          case "MOVE_TO_CLOSE":
            this.targetX = this.closeX; this.targetY = this.closeY;
            if (Math.hypot(this.targetX - this.x, this.targetY - this.y) < 5) {
              this.state = "CLICK_CLOSE"; this.timer = 300; this.scale = 0.85; this.addPulse();
            }
            break;
          case "CLICK_CLOSE":
            this.timer -= dt;
            if (this.timer <= 0) {
              app.modal.isOpen = false; this.state = "WAIT_CLOSE"; this.scale = 1; this.timer = 600;
            }
            break;
          case "WAIT_CLOSE":
            this.timer -= dt;
            if (this.timer <= 0 && app.modal.progress < 0.05) {
              this.state = "IDLE"; this.timer = 2000 + Math.random() * 1000;
              this.targetX += (Math.random() - 0.5) * 100; this.targetY += (Math.random() - 0.5) * 100;
              app.modal.sourceCard = null;
            }
            break;
        }
      }
    }

    function generateCards(matrix: number[]): Card[] {
      const cards: Card[] = [];
      let id = 0;
      for (let c = 0; c < matrix.length; c++)
        for (let r = 0; r < matrix[c]; r++)
          cards.push(new Card(id++, c, r));
      return cards;
    }

    const app1 = { cards: generateCards([3, 2, 1]), cursor: new DragDropCursor() };
    const app2 = { cards: generateCards([2, 2, 2]), cursor: new ModalCursor(), modal: { isOpen: false, progress: 0, sourceCard: null as Card | null, toggleState: false } };
    recalculateIndices(app1.cards);
    recalculateIndices(app2.cards);

    function drawBackgroundGlows() {
      const g1 = ctx.createRadialGradient(width * 0.3, height * 0.3, 0, width * 0.3, height * 0.3, 800);
      g1.addColorStop(0, colors.glowPurple); g1.addColorStop(1, "transparent");
      ctx.fillStyle = g1; ctx.fillRect(0, 0, width, height);
      const fx = Math.sin(time * 0.0005) * 100, fy = Math.cos(time * 0.0003) * 100;
      const g2 = ctx.createRadialGradient(width * 0.7 + fx, height * 0.7 + fy, 0, width * 0.7 + fx, height * 0.7 + fy, 800);
      g2.addColorStop(0, colors.glowGreen); g2.addColorStop(1, "transparent");
      ctx.fillStyle = g2; ctx.fillRect(0, 0, width, height);
    }

    function drawKanbanContent(app: { cards: Card[] }) {
      for (let i = 0; i < colsConfig.count; i++) {
        const colX = colsConfig.padding + i * (colWidth + colsConfig.gap);
        const colY = colsConfig.yOffset;
        const colH = winConfig.height - colsConfig.yOffset - colsConfig.padding;
        ctx.fillStyle = colors.columnBg;
        ctx.beginPath(); (ctx as any).roundRect(colX, colY, colWidth, colH, 10); ctx.fill();
        ctx.fillStyle = colors.textGhost;
        ctx.beginPath(); (ctx as any).roundRect(colX + 15, colY + 15, 50, 6, 3); ctx.fill();
        app.cards.forEach(card => { if (card.colIndex === i) card.updateTargets(colX, colY + 45); });
      }
      app.cards.filter(c => !c.isDragging).forEach(card => { card.update(); card.draw(ctx); });
      app.cards.filter(c => c.isDragging).forEach(card => { card.update(); card.draw(ctx); });
    }

    function drawModalOverlay(app: typeof app2) {
      if (app.modal.progress < 0.01) return;
      const p = app.modal.progress;
      const easeP = 1 - Math.pow(1 - p, 3);
      ctx.fillStyle = `rgba(0,0,0,${easeP * 0.6})`;
      ctx.fillRect(0, winConfig.headerHeight, winConfig.width, winConfig.height);
      const card = app.modal.sourceCard;
      if (!card) return;
      const cursor = app.cursor as ModalCursor;
      const targetW = cursor.modalW, targetH = cursor.modalH;
      const targetX = cursor.modalX, targetY = cursor.modalY;
      const x = card.x + (targetX - card.x) * easeP;
      const y = card.y + (targetY - card.y) * easeP;
      const w = colWidth + (targetW - colWidth) * easeP;
      const h = cardConfig.height + (targetH - cardConfig.height) * easeP;
      ctx.fillStyle = colors.cardBg;
      ctx.beginPath(); (ctx as any).roundRect(x, y, w, h, 16); ctx.fill();
      ctx.strokeStyle = `rgba(123,66,246,${easeP * 0.4})`; ctx.lineWidth = 1; ctx.stroke();
      if (easeP > 0.8) {
        ctx.globalAlpha = (easeP - 0.8) * 5;
        ctx.fillStyle = colors.textGhost;
        ctx.beginPath(); (ctx as any).roundRect(x + 20, y + 20, 120, 8, 4); ctx.fill();
        ctx.beginPath(); (ctx as any).roundRect(x + 20, y + 36, 160, 5, 3); ctx.fill();
        const tX = cursor.toggleX, tY = cursor.toggleY;
        ctx.beginPath(); (ctx as any).roundRect(x + 20, tY + 8, 100, 5, 3); ctx.fill();
        ctx.fillStyle = app.modal.toggleState ? colors.tagGreen : "rgba(255,255,255,0.1)";
        ctx.beginPath(); (ctx as any).roundRect(tX, tY, 40, 24, 12); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(app.modal.toggleState ? tX + 28 : tX + 12, tY + 12, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FF5F56";
        ctx.beginPath(); ctx.arc(cursor.closeX, cursor.closeY, 6, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    function drawMacWindow(winX: number, winY: number, app: any, contentCb: (a: any) => void, overlayCb: ((a: any) => void) | null) {
      const floatY = Math.sin(time * 0.0015 + winX) * 10;
      const curWinY = winY + floatY;
      ctx.save();
      ctx.translate(winX, curWinY);
      ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 25;
      ctx.fillStyle = colors.windowBg;
      ctx.beginPath(); (ctx as any).roundRect(0, 0, winConfig.width, winConfig.height, winConfig.radius); ctx.fill();
      ctx.save();
      ctx.beginPath(); (ctx as any).roundRect(0, 0, winConfig.width, winConfig.height, winConfig.radius); ctx.clip();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath(); (ctx as any).roundRect(0, 0, winConfig.width, winConfig.headerHeight, [winConfig.radius, winConfig.radius, 0, 0]); ctx.fill();
      ["#FF5F56", "#FFBD2E", "#27C93F"].forEach((color, i) => {
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(20 + i * 22, winConfig.headerHeight / 2, 6, 0, Math.PI * 2); ctx.fill();
      });
      ctx.beginPath(); ctx.moveTo(0, winConfig.headerHeight); ctx.lineTo(winConfig.width, winConfig.headerHeight);
      ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.stroke();
      contentCb(app);
      if (overlayCb) overlayCb(app);
      ctx.restore();
      ctx.strokeStyle = colors.windowBorder; ctx.lineWidth = 1;
      ctx.beginPath(); (ctx as any).roundRect(0, 0, winConfig.width, winConfig.height, winConfig.radius); ctx.stroke();
      app.cursor.draw(ctx);
      ctx.restore();
    }

    let lastTime = 0;
    let raf = 0;

    function animate(timestamp: number) {
      if (!lastTime) lastTime = timestamp;
      const deltaTime = timestamp - lastTime;
      lastTime = timestamp;
      time = timestamp;
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBackgroundGlows();
      app1.cursor.update(deltaTime, app1);
      app2.cursor.update(deltaTime, app2);
      if (app2.modal.isOpen) { app2.modal.progress += (1 - app2.modal.progress) * 0.1; }
      else { app2.modal.progress += (0 - app2.modal.progress) * 0.1; }
      const targetLeftBlur = Math.max(0, (mouseX - width / 2) / (width / 2));
      const targetRightBlur = Math.max(0, (width / 2 - mouseX) / (width / 2));
      currentLeftBlur += (targetLeftBlur - currentLeftBlur) * 0.05;
      currentRightBlur += (targetRightBlur - currentRightBlur) * 0.05;
      const maxBlurPx = 8, maxDarken = 0.3;
      const maxSafeGap = width - winConfig.width * 2 - 80;
      const idealGap = Math.max(340, width * 0.25);
      const gap = Math.min(idealGap, Math.max(120, maxSafeGap));
      const totalWidth = winConfig.width * 2 + gap;
      const win1X = width / 2 - totalWidth / 2;
      const win1Y = height / 2 - winConfig.height / 2 - 140;
      ctx.save();
      ctx.filter = `blur(${currentLeftBlur * maxBlurPx}px) brightness(${1 - currentLeftBlur * maxDarken})`;
      drawMacWindow(win1X, win1Y, app1, drawKanbanContent, null);
      ctx.restore();
      const win2X = win1X + winConfig.width + gap;
      const win2Y = height / 2 - winConfig.height / 2 + 160;
      ctx.save();
      ctx.filter = `blur(${currentRightBlur * maxBlurPx}px) brightness(${1 - currentRightBlur * maxDarken})`;
      drawMacWindow(win2X, win2Y, app2, drawKanbanContent, drawModalOverlay);
      ctx.restore();
      raf = requestAnimationFrame(animate);
    }

    const onMouseMove = (e: MouseEvent) => { mouseX = e.clientX; };
    const onMouseLeave = () => { mouseX = window.innerWidth / 2; };
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);
    resize();
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 1 }}
    />
  );
}
