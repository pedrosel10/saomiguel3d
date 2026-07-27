import * as THREE from 'three';
import gsap from 'gsap';

export function setupTeamGears() {
  const canvas = document.getElementById('team-webgl-canvas');
  if (!canvas) return null;

  // 1. Cena Three.js Dedicada
  const scene = new THREE.Scene();

  // 2. Câmera Frontal Direta (Visão 100% Frontal sem Perspectiva Isométrica)
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);

  // 3. Renderer Dedicado no Canvas da Equipe
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  const maxDPR = window.innerWidth <= 768 ? 1.85 : 2.0;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDPR));

  // 4. Iluminação Dedicada (Frontal + Luzes Azuis Internas)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
  scene.add(ambientLight);

  const frontLight = new THREE.DirectionalLight(0xe0f2fe, 8.5);
  frontLight.position.set(0, 2, 8);
  scene.add(frontLight);

  const createInnerBlueLight = () => {
    const light = new THREE.PointLight(0x0066ff, 160.0, 3.0, 2.0);
    light.position.set(-0.2, -0.1, -0.5);
    return light;
  };

  // 5. Estado Interno do Módulo
  const state = {
    leftGear: null,
    rightGear: null,
    active: false,
    scrollVelocity: 0,
    rotLeft: 0,
    rotRight: 0
  };

  // Função utilitária para clonar o modelo 3D removendo apenas as malhas de wireframe
  const cloneCleanMesh = (source) => {
    const clone = source.clone(true);
    const toRemove = [];
    clone.traverse((child) => {
      if (child.name === 'WireframeSkeleton') {
        toRemove.push(child);
      }
    });
    toRemove.forEach((child) => {
      if (child.parent) child.parent.remove(child);
      if (child.geometry) child.geometry.dispose();
    });
    return clone;
  };

  // Função para carregar e clonar a engrenagem quando o modelo 3D estiver disponível
  const initGears = (sourceMesh) => {
    if (!sourceMesh || state.leftGear) return;

    // Engrenagem Esquerda (Visão Frontal - Sem malhas de wireframe/hover)
    const gL = new THREE.Group();
    gL.add(cloneCleanMesh(sourceMesh));
    gL.add(createInnerBlueLight());
    scene.add(gL);

    // Engrenagem Direita (Visão Frontal - Sem malhas de wireframe/hover)
    const gR = new THREE.Group();
    gR.add(cloneCleanMesh(sourceMesh));
    gR.add(createInnerBlueLight());
    scene.add(gR);

    // Orientação 100% Frontal
    gL.rotation.set(0, 0, 0);
    gR.rotation.set(0, 0, 0);

    state.leftGear = gL;
    state.rightGear = gR;

    updateGearPositions();
  };

  // Posições e Escala Fixas
  const updateGearPositions = () => {
    if (!state.leftGear || !state.rightGear) return;

    const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);

    if (isMobile) {
      // No Mobile: engrenagens menores (1.15) e a da direita ligeiramente à frente no eixo Z (0.8)
      state.leftGear.position.set(-1.4, -3.2, 0.0);
      state.rightGear.position.set(1.4, -3.0, 0.8);
      state.leftGear.scale.set(1.15, 1.15, 1.15);
      state.rightGear.scale.set(1.15, 1.15, 1.15);
    } else {
      // No Desktop: aproximadamente 5% ajustadas para enquadramento perfeito
      state.leftGear.position.set(-8.15, 0.0, 0.0);
      state.rightGear.position.set(8.15, 0.0, 0.0);
      state.leftGear.scale.set(2.5, 2.5, 2.5);
      state.rightGear.scale.set(2.5, 2.5, 2.5);
    }
  };

  // 6. Redimensionamento de Tela
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    const dpr = window.innerWidth <= 768 ? 1.85 : 2.0;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, dpr));

    updateGearPositions();
  });

  // 7. Ouvinte de Scroll do Mouse na Dobra Equipe (Com controle suave e limite máximo de velocidade)
  const teamSection = document.getElementById('team');
  let lastScrollTop = 0;
  const MAX_SCROLL_SPEED = 0.025; // Teto de velocidade máxima de giro por scroll

  const clampSpeed = (val) => Math.max(-MAX_SCROLL_SPEED, Math.min(MAX_SCROLL_SPEED, val));

  if (teamSection) {
    teamSection.addEventListener('scroll', () => {
      if (!state.active) return;
      const currentScrollTop = teamSection.scrollTop;
      const deltaY = currentScrollTop - lastScrollTop;
      lastScrollTop = currentScrollTop;

      state.scrollVelocity = clampSpeed(state.scrollVelocity + deltaY * 0.0005);
    }, { passive: true });

    teamSection.addEventListener('wheel', (event) => {
      if (!state.active) return;
      state.scrollVelocity = clampSpeed(state.scrollVelocity + event.deltaY * 0.00035);
    }, { passive: true });

    let touchStartY = 0;
    teamSection.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) touchStartY = e.touches[0].clientY;
    }, { passive: true });

    teamSection.addEventListener('touchmove', (e) => {
      if (!state.active || e.touches.length === 0) return;
      const touchY = e.touches[0].clientY;
      const deltaY = touchStartY - touchY;
      touchStartY = touchY;

      state.scrollVelocity = clampSpeed(state.scrollVelocity + deltaY * 0.0006);
    }, { passive: true });
  }

  // 8. Loop de Renderização da Câmera Frontal (Rotação cadenciada com velocidade controlada)
  const clock = new THREE.Clock();
  let animId = null;

  const renderLoop = () => {
    if (state.active) {
      const delta = clock.getDelta();
      const slowSpin = delta * 0.35; // Rotação ambiente contínua suave

      state.rotLeft += slowSpin + state.scrollVelocity * 0.4;
      state.rotRight -= (slowSpin + state.scrollVelocity * 0.4);
      state.scrollVelocity *= 0.90; // Fricção fluida

      if (state.leftGear) state.leftGear.rotation.z = state.rotLeft;
      if (state.rightGear) state.rightGear.rotation.z = state.rotRight;

      renderer.render(scene, camera);
    } else {
      clock.getDelta();
    }
    animId = requestAnimationFrame(renderLoop);
  };

  renderLoop();

  return {
    initGears,
    show: () => {
      state.active = true;
      state.scrollVelocity = 0;

      if (!state.leftGear || !state.rightGear) return;

      const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);

      const targetLeftX = isMobile ? -1.4 : -8.15;
      const targetRightX = isMobile ? 1.4 : 8.15;

      const targetLeftY = isMobile ? -3.2 : 0.0;
      const targetRightY = isMobile ? -3.0 : 0.0;

      const targetLeftZ = isMobile ? 0.0 : 0.0;
      const targetRightZ = isMobile ? 0.8 : 0.0;

      const startLeftX = isMobile ? -5.0 : -18.0;
      const startRightX = isMobile ? 5.0 : 18.0;

      const gearScale = isMobile ? 1.15 : 2.5;

      // Posição inicial fora da tela nas laterais
      state.leftGear.position.set(startLeftX, targetLeftY, targetLeftZ);
      state.rightGear.position.set(startRightX, targetRightY, targetRightZ);

      state.leftGear.scale.set(gearScale, gearScale, gearScale);
      state.rightGear.scale.set(gearScale, gearScale, gearScale);

      // Animação GSAP de Entrada (Aguardar a dobra subir 100% primeiro)
      const tl = gsap.timeline({ delay: isMobile ? 1.8 : 2.3 });

      // 1. As 2 engrenagens deslizam suavemente para as posições de borda
      tl.to(state.leftGear.position, {
        x: targetLeftX,
        duration: 2.0,
        ease: 'power2.out'
      }, 0);

      tl.to(state.rightGear.position, {
        x: targetRightX,
        duration: 2.0,
        ease: 'power2.out'
      }, 0);

      // 2. Giro mais lento e cadenciado no SENTIDO CONTRÁRIO durante a entrada
      tl.to(state, {
        rotLeft: state.rotLeft - Math.PI * 1.2,
        rotRight: state.rotRight + Math.PI * 1.2,
        duration: 2.0,
        ease: 'power2.out'
      }, 0);
    },
    hide: () => {
      if (!state.leftGear || !state.rightGear) {
        state.active = false;
        return;
      }

      const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);
      const startLeftX = isMobile ? -8.0 : -18.0;
      const startRightX = isMobile ? 8.0 : 18.0;

      const tl = gsap.timeline({
        onComplete: () => {
          state.active = false;
          if (canvas) {
            const ctx = canvas.getContext('webgl') || canvas.getContext('webgl2');
            if (ctx) ctx.clear(ctx.COLOR_BUFFER_BIT);
          }
        }
      });

      // Roladinha de saída para fora das laterais
      tl.to(state.leftGear.position, {
        x: startLeftX,
        duration: 0.9,
        ease: 'power2.in'
      }, 0);

      tl.to(state.rightGear.position, {
        x: startRightX,
        duration: 0.9,
        ease: 'power2.in'
      }, 0);

      tl.to(state, {
        rotLeft: state.rotLeft - Math.PI * 1.8,
        rotRight: state.rotRight + Math.PI * 1.8,
        duration: 0.9,
        ease: 'power2.in'
      }, 0);
    }
  };
}
