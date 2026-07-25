import * as THREE from 'three';

/**
 * Fumaça 3D realista no pouso do h1.
 * Canvas Three.js temporário transparente posicionado à frente do texto.
 *
 * Técnicas de realismo:
 * - Múltiplas texturas procedurais com formas orgânicas irregulares
 * - Dois tipos de partículas: nuvens grandes de fundo + núcleo denso
 * - Simulação de gravidade e arrasto (drag)
 * - Vento lateral consistente
 * - Fade-in suave → plateau → fade-out longo
 * - Rotação contínua para quebrar repetição visual
 */
export function spawnSmoke3D(anchorEl) {
  const rect = anchorEl.getBoundingClientRect();

  // --- Canvas overlay ---
  const canvas = document.createElement('canvas');
  const margin = 160;
  const w = rect.width + margin * 2;
  const h = 200;

  canvas.width = w * window.devicePixelRatio;
  canvas.height = h * window.devicePixelRatio;

  Object.assign(canvas.style, {
    position: 'fixed',
    left: (rect.left - margin) + 'px',
    top: (rect.bottom - h + 40) + 'px',
    width: w + 'px',
    height: h + 'px',
    pointerEvents: 'none',
    zIndex: '30',
  });
  document.body.appendChild(canvas);

  // --- Renderer ---
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 0);

  // --- Câmera ortográfica ---
  const camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 100);
  camera.position.z = 10;

  const scene = new THREE.Scene();

  // --- Gerar 4 texturas orgânicas diferentes ---
  const textures = [];
  for (let i = 0; i < 4; i++) {
    textures.push(createOrganicSmokeTexture(i));
  }

  // --- Vento lateral consistente (leve brisa para a esquerda) ---
  const windX = -12 - Math.random() * 8;
  const windY = 3;

  // --- Partículas em duas camadas ---
  const PARTICLE_COUNT = 32;
  const particles = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Camada: 40% são nuvens de fundo (maiores, mais transparentes), 60% são núcleo
    const isBackground = i < PARTICLE_COUNT * 0.4;

    const tex = textures[Math.floor(Math.random() * textures.length)];

    // Cores: variação entre cinza quente e cinza frio
    const hue = 0.05 + Math.random() * 0.08;
    const sat = 0.03 + Math.random() * 0.05;
    const lum = isBackground
      ? 0.35 + Math.random() * 0.15   // fundo: cinza médio
      : 0.20 + Math.random() * 0.12;  // núcleo: cinza escuro

    const spriteMat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.NormalBlending,
      color: new THREE.Color().setHSL(hue, sat, lum),
    });

    const sprite = new THREE.Sprite(spriteMat);

    // Posição: espalhada ao longo da base, núcleo mais concentrado no centro
    const spread = isBackground ? rect.width * 1.1 : rect.width * 0.7;
    const spawnX = (Math.random() - 0.5) * spread;
    const spawnY = -h / 2 + 35;
    sprite.position.set(spawnX, spawnY, isBackground ? -1 : 0);

    const baseSize = isBackground
      ? 45 + Math.random() * 50   // fundo: grandes
      : 22 + Math.random() * 35;  // núcleo: menores e mais densos
    sprite.scale.set(baseSize, baseSize, 1);

    scene.add(sprite);

    particles.push({
      sprite,
      material: spriteMat,
      isBackground,
      // Velocidade inicial (impulso do impacto)
      vx: (Math.random() - 0.5) * (isBackground ? 60 : 80),
      vy: isBackground ? 25 + Math.random() * 35 : 35 + Math.random() * 50,
      // Gravidade e arrasto
      gravity: -8 - Math.random() * 5,   // puxa pra baixo levemente
      drag: 0.96 + Math.random() * 0.03, // desacelera gradualmente (0.96–0.99)
      // Turbulência orgânica
      turbFreq: 1.2 + Math.random() * 2.5,
      turbAmp: 10 + Math.random() * 18,
      turbPhase: Math.random() * Math.PI * 2,
      // Vida
      life: 0,
      maxLife: isBackground
        ? 1.2 + Math.random() * 1.0   // fundo: vive mais
        : 0.6 + Math.random() * 0.8,  // núcleo: mais curto
      delay: Math.random() * 0.06,
      // Escala
      baseSize,
      growRate: isBackground ? 1.8 + Math.random() * 0.8 : 1.2 + Math.random() * 0.6,
      // Rotação
      rotSpeed: (Math.random() - 0.5) * 2.2,
      // Opacidade máxima
      peakOpacity: isBackground ? 0.4 + Math.random() * 0.15 : 0.65 + Math.random() * 0.2,
    });
  }

  // --- Loop de animação ---
  const clock = new THREE.Clock();
  let elapsed = 0;
  const maxDuration = 2.8;
  let animId;

  function animate() {
    const dt = Math.min(clock.getDelta(), 0.05); // cap dt para evitar saltos
    elapsed += dt;

    let allDead = true;

    for (const p of particles) {
      if (elapsed < p.delay) { allDead = false; continue; }

      p.life += dt;
      const t = p.life / p.maxLife;

      if (t > 1) {
        p.sprite.visible = false;
        continue;
      }
      allDead = false;

      // --- Opacidade realista: fade-in rápido → plateau → fade-out longo ---
      const fadeIn = Math.min(p.life / 0.1, 1);
      const fadeOut = 1 - Math.pow(Math.max(t - 0.3, 0) / 0.7, 2); // plateau até 30%, depois fade
      p.material.opacity = fadeIn * Math.max(fadeOut, 0) * p.peakOpacity;

      // --- Física: velocidade + arrasto + gravidade + vento ---
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.vy += p.gravity * dt;

      // Turbulência orgânica (sinusoidal com variação)
      const turbX = Math.sin(p.life * p.turbFreq + p.turbPhase) * p.turbAmp * Math.min(t * 3, 1);

      p.sprite.position.x += (p.vx + windX + turbX) * dt;
      p.sprite.position.y += (p.vy + windY) * dt;

      // --- Escala crescente (fumaça expande ao dissipar) ---
      const s = p.baseSize * (1 + t * p.growRate);
      p.sprite.scale.set(s, s, 1);

      // --- Rotação contínua ---
      p.material.rotation += p.rotSpeed * dt;
    }

    renderer.render(scene, camera);

    if (allDead || elapsed > maxDuration) {
      cleanup();
      return;
    }

    animId = requestAnimationFrame(animate);
  }

  function cleanup() {
    cancelAnimationFrame(animId);
    renderer.dispose();
    for (const tex of textures) tex.dispose();
    for (const p of particles) p.material.dispose();
    scene.clear();
    canvas.remove();
  }

  animate();
}

/**
 * Gera uma textura de fumaça orgânica e irregular.
 * Usa múltiplos blobs sobrepostos em vez de um gradiente radial perfeito,
 * criando bordas irregulares mais naturais.
 */
function createOrganicSmokeTexture(seed) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');

  // Fundo transparente
  ctx.clearRect(0, 0, size, size);

  // Empilhar 5-7 blobs deslocados para criar forma orgânica
  const blobCount = 5 + (seed % 3);
  const cx = size / 2;
  const cy = size / 2;

  for (let b = 0; b < blobCount; b++) {
    // Cada blob é um gradiente radial deslocado do centro
    const offsetX = (pseudoRandom(seed * 13 + b * 7) - 0.5) * size * 0.3;
    const offsetY = (pseudoRandom(seed * 17 + b * 11) - 0.5) * size * 0.3;
    const blobRadius = size * (0.25 + pseudoRandom(seed * 23 + b * 3) * 0.25);

    const gradient = ctx.createRadialGradient(
      cx + offsetX, cy + offsetY, 0,
      cx + offsetX, cy + offsetY, blobRadius
    );

    const alpha = 0.15 + pseudoRandom(seed * 31 + b * 19) * 0.15;
    gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    gradient.addColorStop(0.4, `rgba(245, 240, 235, ${alpha * 0.7})`);
    gradient.addColorStop(0.7, `rgba(230, 225, 220, ${alpha * 0.3})`);
    gradient.addColorStop(1, 'rgba(220, 215, 210, 0.0)');

    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx + offsetX, cy + offsetY, blobRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Gradiente radial final para suavizar bordas gerais
  ctx.globalCompositeOperation = 'destination-in';
  const edgeFade = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.48);
  edgeFade.addColorStop(0, 'rgba(255,255,255,1)');
  edgeFade.addColorStop(0.7, 'rgba(255,255,255,0.8)');
  edgeFade.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = edgeFade;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(c);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Gerador pseudo-aleatório determinístico simples (baseado em seed).
 * Garante que as texturas sejam consistentes mas diferentes entre si.
 */
function pseudoRandom(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
