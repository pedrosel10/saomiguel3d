import * as THREE from 'three';

/**
 * Fumaça 3D realista no pouso do h1.
 * Canvas Three.js temporário transparente posicionado à frente do texto.
 *
 * Pré-carregamento: texturas, renderer e sprites são criados durante o loading
 * para evitar qualquer travada no momento do impacto.
 */

// --- Cache pré-carregado ---
let _preloaded = null;

/**
 * Pré-inicializa texturas, renderer, cena e sprites durante o loading.
 * Chame esta função enquanto a tela de carregamento estiver visível.
 */
export function preloadSmoke() {
  // Gerar 4 texturas orgânicas
  const textures = [];
  for (let i = 0; i < 4; i++) {
    textures.push(createOrganicSmokeTexture(i));
  }

  // Canvas placeholder (será reposicionado no momento do spawn)
  const canvas = document.createElement('canvas');
  const placeholderW = 600;
  const placeholderH = 450;
  canvas.width = placeholderW * window.devicePixelRatio;
  canvas.height = placeholderH * window.devicePixelRatio;

  Object.assign(canvas.style, {
    position: 'fixed',
    left: '-9999px', // escondido fora da tela
    top: '-9999px',
    width: placeholderW + 'px',
    height: placeholderH + 'px',
    pointerEvents: 'none',
    zIndex: '30',
  });
  document.body.appendChild(canvas);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(placeholderW, placeholderH);
  renderer.setClearColor(0x000000, 0);

  // Câmera ortográfica
  const camera = new THREE.OrthographicCamera(
    -placeholderW / 2, placeholderW / 2,
    placeholderH / 2, -placeholderH / 2,
    0.1, 100
  );
  camera.position.z = 10;

  const scene = new THREE.Scene();

  // Vento lateral
  const windX = -12 - Math.random() * 8;
  const windY = 3;

  // Pré-criar as partículas (sprites + materiais)
  const PARTICLE_COUNT = 32;
  const particles = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const isBackground = i < PARTICLE_COUNT * 0.4;
    const tex = textures[Math.floor(Math.random() * textures.length)];

    const hue = 0.05 + Math.random() * 0.08;
    const sat = 0.03 + Math.random() * 0.05;
    const lum = isBackground
      ? 0.35 + Math.random() * 0.15
      : 0.20 + Math.random() * 0.12;

    const spriteMat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.NormalBlending,
      color: new THREE.Color().setHSL(hue, sat, lum),
    });

    const sprite = new THREE.Sprite(spriteMat);
    sprite.visible = false; // escondido até o spawn
    scene.add(sprite);

    const baseSize = isBackground
      ? 45 + Math.random() * 50
      : 22 + Math.random() * 35;

    particles.push({
      sprite,
      material: spriteMat,
      isBackground,
      baseSize,
      // Velocidades pré-calculadas
      _vx: (Math.random() - 0.5) * (isBackground ? 60 : 80),
      _vy: isBackground ? 25 + Math.random() * 35 : 35 + Math.random() * 50,
      gravity: -8 - Math.random() * 5,
      drag: 0.96 + Math.random() * 0.03,
      turbFreq: 1.2 + Math.random() * 2.5,
      turbAmp: 10 + Math.random() * 18,
      turbPhase: Math.random() * Math.PI * 2,
      maxLife: isBackground ? 1.2 + Math.random() * 1.0 : 0.6 + Math.random() * 0.8,
      delay: Math.random() * 0.06,
      growRate: isBackground ? 1.8 + Math.random() * 0.8 : 1.2 + Math.random() * 0.6,
      rotSpeed: (Math.random() - 0.5) * 2.2,
      peakOpacity: isBackground ? 0.4 + Math.random() * 0.15 : 0.65 + Math.random() * 0.2,
      // Estado runtime (resetado no spawn)
      vx: 0, vy: 0, life: 0,
    });
  }

  // Warm-up render — força compilação de shaders no GPU
  renderer.render(scene, camera);

  _preloaded = { canvas, renderer, camera, scene, textures, particles, windX, windY, PARTICLE_COUNT };
}

/**
 * Dispara a animação de fumaça posicionada na base do anchorEl.
 * Usa os recursos pré-carregados pelo preloadSmoke().
 */
export function spawnSmoke3D(anchorEl) {
  if (!_preloaded) {
    // Fallback: se preload não foi chamado, inicializa agora
    preloadSmoke();
  }

  const { canvas, renderer, camera, scene, textures, particles, windX, windY } = _preloaded;

  const rect = anchorEl.getBoundingClientRect();
  const margin = 180;
  const w = rect.width + margin * 2;
  const h = 450;

  // Redimensionar canvas e renderer para o tamanho real com margem vertical ampla
  canvas.width = w * window.devicePixelRatio;
  canvas.height = h * window.devicePixelRatio;
  canvas.style.left = (rect.left - margin) + 'px';
  canvas.style.top = (rect.bottom - h + 160) + 'px';
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';

  renderer.setSize(w, h);

  // Atualizar câmera ortográfica
  camera.left = -w / 2;
  camera.right = w / 2;
  camera.top = h / 2;
  camera.bottom = -h / 2;
  camera.updateProjectionMatrix();

  // Resetar e posicionar partículas
  for (const p of particles) {
    const spread = p.isBackground ? rect.width * 1.1 : rect.width * 0.7;
    p.sprite.position.set(
      (Math.random() - 0.5) * spread,
      -h / 2 + 160,
      p.isBackground ? -1 : 0
    );
    p.sprite.scale.set(p.baseSize, p.baseSize, 1);
    p.sprite.visible = true;
    p.material.opacity = 0;

    // Resetar estado de animação
    p.vx = p._vx;
    p.vy = p._vy;
    p.life = 0;
  }

  // --- Loop de animação ---
  const clock = new THREE.Clock();
  let elapsed = 0;
  const maxDuration = 2.8;
  let animId;

  function animate() {
    const dt = Math.min(clock.getDelta(), 0.05);
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

      // Opacidade: fade-in rápido → plateau → fade-out longo
      const fadeIn = Math.min(p.life / 0.1, 1);
      const fadeOut = 1 - Math.pow(Math.max(t - 0.3, 0) / 0.7, 2);
      p.material.opacity = fadeIn * Math.max(fadeOut, 0) * p.peakOpacity;

      // Física: velocidade + arrasto + gravidade + vento
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.vy += p.gravity * dt;

      const turbX = Math.sin(p.life * p.turbFreq + p.turbPhase) * p.turbAmp * Math.min(t * 3, 1);

      p.sprite.position.x += (p.vx + windX + turbX) * dt;
      p.sprite.position.y += (p.vy + windY) * dt;

      // Escala crescente
      const s = p.baseSize * (1 + t * p.growRate);
      p.sprite.scale.set(s, s, 1);

      // Rotação
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
    // Esconde o canvas fora da tela (mantém recursos para possível reuso)
    canvas.style.left = '-9999px';
    canvas.style.top = '-9999px';
    for (const p of particles) {
      p.sprite.visible = false;
    }
    // Liberar referência para permitir GC eventual
    _preloaded = null;
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
 */
function createOrganicSmokeTexture(seed) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');

  ctx.clearRect(0, 0, size, size);

  const blobCount = 5 + (seed % 3);
  const cx = size / 2;
  const cy = size / 2;

  for (let b = 0; b < blobCount; b++) {
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

function pseudoRandom(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
