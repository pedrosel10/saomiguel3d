import gsap from 'gsap';

class BrickTransition {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.animating = false;
    this.bricks = [];
    this.animationFrameId = null;

    this.init();
  }

  init() {
    // Buscar ou criar o canvas de transição
    this.canvas = document.getElementById('brick-transition-canvas');
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'brick-transition-canvas';
      this.canvas.className = 'brick-transition-canvas';
      document.body.appendChild(this.canvas);
    }

    this.ctx = this.canvas.getContext('2d');

    // Estilos do canvas
    Object.assign(this.canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '99999',
      pointerEvents: 'none',
      display: 'none'
    });

    window.addEventListener('resize', () => {
      if (this.animating) {
        this.resizeCanvas();
      }
    });
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.scale(dpr, dpr);
  }

  /**
   * Transição de Tijolos Montando o Muro (de baixo/esquerda -> cima/direita)
   * e Desfazendo Aleatoriamente para Revelar a Dobra da Equipe por Trás (tijolo por tijolo)
   * @param {Function} onWallBuilt Callback executado quando o muro cobre 100% da tela para posicionar a dobra atrás
   * @param {Function} onComplete Callback executado quando todos os tijolos já sumiram
   */
  startTransition(onWallBuilt, onComplete) {
    if (this.animating) return;

    this.animating = true;
    this.canvas.style.display = 'block';
    this.canvas.style.pointerEvents = 'auto'; // Bloqueia cliques durante a transição
    this.resizeCanvas();

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Configurar tamanho dos tijolos responsivos
    const isMobile = width <= 768;
    const brickHeight = isMobile ? 42 : 62;
    const brickWidth = isMobile ? 95 : 140;

    const rows = Math.ceil(height / brickHeight) + 2;
    const cols = Math.ceil(width / brickWidth) + 3;

    this.bricks = [];

    // Gerar lista de tijolos empilhados (padrão de amarração intercalada)
    for (let r = 0; r < rows; r++) {
      // Linha 0 é a base inferior, subindo até o topo
      const targetY = height - (r + 1) * brickHeight;
      const isOddRow = r % 2 === 1;
      const rowOffsetX = isOddRow ? -brickWidth / 2 : 0;

      for (let c = -1; c < cols; c++) {
        const targetX = c * brickWidth + rowOffsetX;

        this.bricks.push({
          x: targetX,
          y: -brickHeight * 4 - Math.random() * 60, // Posição inicial acima do topo da tela
          targetX: targetX,
          targetY: targetY,
          width: brickWidth,
          height: brickHeight,
          row: r, // 0 = base inferior
          col: c,
          opacity: 1,
          visible: false
        });
      }
    }

    // Ordenar para montagem do muro: da base (r=0) para o topo, da esquerda para a direita
    const sortedBricks = [...this.bricks].sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });

    // Iniciar loop de renderização no canvas
    const render = () => {
      if (!this.animating) return;
      this.draw();
      this.animationFrameId = requestAnimationFrame(render);
    };
    render();

    const buildTl = gsap.timeline();

    // 1. FASE DE CONSTRUÇÃO DO MURO (Tijolos caindo de baixo pra cima, esquerda pra direita)
    const baseDelayPerRow = isMobile ? 0.045 : 0.035;
    const delayPerCol = isMobile ? 0.01 : 0.008;

    sortedBricks.forEach((brick) => {
      const rowDelay = brick.row * baseDelayPerRow;
      const colDelay = (brick.col + 1) * delayPerCol;
      const startTime = rowDelay + colDelay;

      buildTl.to(
        brick,
        {
          y: brick.targetY,
          duration: isMobile ? 0.35 : 0.42,
          ease: 'power2.in',
          onStart: () => {
            brick.visible = true;
          }
        },
        startTime
      );
    });

    const wallCompleteTime = buildTl.duration();

    // 2. FASE DE TROCA DA TELA (No instante exato em que o muro de tijolos se fecha 100%)
    buildTl.add(() => {
      if (typeof onWallBuilt === 'function') {
        onWallBuilt();
      }
    }, wallCompleteTime + 0.05);

    // 3. FASE DE DESCONSTRUÇÃO E REVELAÇÃO DA DOBRA (Sumindo os tijolos aleatoriamente e revelando a dobra atrás tijolo por tijolo)
    buildTl.add(() => {
      const destroyTl = gsap.timeline({
        onComplete: () => {
          this.cleanup();
          if (typeof onComplete === 'function') {
            onComplete();
          }
        }
      });

      // Embaralhar ordem dos tijolos para desfazimento aleatório
      const shuffledBricks = [...this.bricks].sort(() => Math.random() - 0.5);
      const destroyStagger = isMobile ? 0.003 : 0.0025;

      shuffledBricks.forEach((brick, index) => {
        destroyTl.to(
          brick,
          {
            opacity: 0,
            duration: isMobile ? 0.22 : 0.28,
            ease: 'power2.out'
          },
          index * destroyStagger
        );
      });
    }, wallCompleteTime + 0.15);
  }

  draw() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.ctx.clearRect(0, 0, width, height);

    // Renderizar cada tijolo do muro
    this.bricks.forEach((b) => {
      if (!b.visible || b.opacity <= 0) return;

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, Math.min(1, b.opacity));

      const drawW = b.width + 1.0;
      const drawH = b.height + 1.0;

      // Tijolo azul com encaixe perfeito sem fresta
      this.ctx.fillStyle = '#0055ff';
      this.ctx.fillRect(b.x, b.y, drawW, drawH);

      // Borda do tijolo azul
      this.ctx.strokeStyle = '#0033b3';
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeRect(b.x, b.y, b.width, b.height);

      this.ctx.restore();
    });
  }

  cleanup() {
    this.animating = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.ctx) {
      this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
    if (this.canvas) {
      this.canvas.style.display = 'none';
      this.canvas.style.pointerEvents = 'none';
    }
  }
}

export const brickTransition = new BrickTransition();
