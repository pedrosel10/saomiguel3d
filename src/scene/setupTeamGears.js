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
    rotRight: 0,
    baseLeftPos: new THREE.Vector3(),
    baseRightPos: new THREE.Vector3(),
    scrollOffsetProgress: 0,
    targetScrollOffsetProgress: 0
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
    });
    return clone;
  };

  // Função para carregar e clonar a engrenagem quando o modelo 3D estiver disponível
  const initGears = (sourceMesh) => {
    if (!sourceMesh || state.leftGear) return;

    // Engrenagem Esquerda (Visão Frontal - Sem malhas de wireframe/hover)
    const gL = new THREE.Group();
    const cleanL = cloneCleanMesh(sourceMesh);
    cleanL.traverse(child => { if (child.isMesh) { child.castShadow = false; child.receiveShadow = false; } });
    gL.add(cleanL);
    gL.add(createInnerBlueLight());
    scene.add(gL);

    // Engrenagem Direita (Visão Frontal - Sem malhas de wireframe/hover)
    const gR = new THREE.Group();
    const cleanR = cloneCleanMesh(sourceMesh);
    cleanR.traverse(child => { if (child.isMesh) { child.castShadow = false; child.receiveShadow = false; } });
    gR.add(cleanR);
    gR.add(createInnerBlueLight());
    scene.add(gR);

    // Inicialmente ocultas até a animação ser ativada pelo clique em Equipe
    gL.visible = false;
    gR.visible = false;

    state.leftGear = gL;
    state.rightGear = gR;

    updateGearPositions();

    // Warm-up / Pré-compilação WebGL na VRAM durante o carregamento inicial (sem deixar marcas no canvas)
    try {
      gL.visible = true;
      gR.visible = true;
      renderer.compile(scene, camera);
      renderer.render(scene, camera);
      gL.visible = false;
      gR.visible = false;
      renderer.clear();
    } catch (err) {
      console.warn('Warmup team gears renderer warning:', err);
    }
  };

  // Posições e Escala Fixas (No Mobile: posicionadas nos cantos inferiores em Y = -3.6 / -3.4)
  const updateGearPositions = () => {
    if (!state.leftGear || !state.rightGear) return;

    const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);

    if (isMobile) {
      // No Mobile: aproximadas no eixo X (X = -0.9 / 0.9), rebaixadas 20% no eixo Y (Y = -4.2 / -4.0), scale = 0.85
      state.baseLeftPos.set(-0.9, -4.2, 0.0);
      state.baseRightPos.set(0.9, -4.0, 0.8);
      state.leftGear.scale.set(0.85, 0.85, 0.85);
      state.rightGear.scale.set(0.85, 0.85, 0.85);
    } else {
      // No Desktop: tamanho e enquadramento calibrados
      state.baseLeftPos.set(-8.15, 0.0, 0.0);
      state.baseRightPos.set(8.15, 0.0, 0.0);
      state.leftGear.scale.set(2.5, 2.5, 2.5);
      state.rightGear.scale.set(2.5, 2.5, 2.5);
    }

    if (!state.active) {
      state.leftGear.position.copy(state.baseLeftPos);
      state.rightGear.position.copy(state.baseRightPos);
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

  // 7. Ouvinte de Scroll na Dobra Equipe (A saída só é disparada ao atingir o limite "0" do scroll da dobra)
  const teamSection = document.getElementById('team');
  let lastScrollTop = 0;
  let overscrollProgress = 0;
  const MAX_SCROLL_SPEED = 0.025; // Teto de velocidade máxima de giro por scroll

  const clampSpeed = (val) => Math.max(-MAX_SCROLL_SPEED, Math.min(MAX_SCROLL_SPEED, val));

  const updateScrollOffset = (deltaY = 0) => {
    if (!teamSection || !state.active) return;
    const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);
    if (!isMobile) {
      state.targetScrollOffsetProgress = 0;
      return;
    }

    const maxScroll = Math.max(1, teamSection.scrollHeight - teamSection.clientHeight);
    const currentScroll = teamSection.scrollTop;
    const isAtBottom = (currentScroll >= maxScroll - 8);

    if (isAtBottom && deltaY > 0) {
      // Rolando para baixo no limite: extensão de scroll tirando as engrenagens da tela
      overscrollProgress = Math.min(1.0, overscrollProgress + deltaY * 0.0035);
    } else if (deltaY < 0 && overscrollProgress > 0) {
      // Rolando para cima com engrenagens fora: traz as engrenagens de volta ANTES do texto subir
      overscrollProgress = Math.max(0.0, overscrollProgress + deltaY * 0.0035);

      // Mantém o texto no limite do fundo enquanto as engrenagens retornam
      if (overscrollProgress > 0.01) {
        teamSection.scrollTop = maxScroll;
      }
    } else if (currentScroll < maxScroll - 20 && overscrollProgress > 0) {
      // Reset de segurança se o scroll pular para cima
      overscrollProgress = Math.max(0.0, overscrollProgress - 0.1);
    }

    state.targetScrollOffsetProgress = overscrollProgress;
  };

  if (teamSection) {
    teamSection.addEventListener('scroll', () => {
      if (!state.active) return;
      const currentScrollTop = teamSection.scrollTop;
      const deltaY = currentScrollTop - lastScrollTop;
      lastScrollTop = currentScrollTop;

      updateScrollOffset(deltaY);
      state.scrollVelocity = clampSpeed(state.scrollVelocity + deltaY * 0.0005);
    }, { passive: true });

    teamSection.addEventListener('wheel', (event) => {
      if (!state.active) return;
      updateScrollOffset(event.deltaY);
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

      updateScrollOffset(deltaY);
      state.scrollVelocity = clampSpeed(state.scrollVelocity + deltaY * 0.0006);
    }, { passive: true });
  }

  // 8. Loop de Renderização da Câmera Frontal (Rotação + Deslocamento Dinâmico de Saída pelo Scroll no Limite)
  const clock = new THREE.Clock();
  let animId = null;

  const renderLoop = () => {
    if (state.active) {
      const delta = clock.getDelta();
      const slowSpin = delta * 0.35; // Rotação ambiente contínua suave

      state.rotLeft += slowSpin + state.scrollVelocity * 0.4;
      state.rotRight -= (slowSpin + state.scrollVelocity * 0.4);
      state.scrollVelocity *= 0.90; // Fricção fluida

      // Lerp ultra-suave do deslocamento de saída no limite (8% por frame)
      state.scrollOffsetProgress += (state.targetScrollOffsetProgress - state.scrollOffsetProgress) * 0.08;

      const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);
      const exitDx = isMobile ? 4.5 : 0.0;
      const exitDy = isMobile ? 3.0 : 0.0;
      const offset = isMobile ? state.scrollOffsetProgress : 0.0;

      if (state.leftGear) {
        state.leftGear.rotation.z = state.rotLeft;
        state.leftGear.position.x = state.baseLeftPos.x - exitDx * offset;
        state.leftGear.position.y = state.baseLeftPos.y - exitDy * offset;
        state.leftGear.position.z = state.baseLeftPos.z;
      }

      if (state.rightGear) {
        state.rightGear.rotation.z = state.rotRight;
        state.rightGear.position.x = state.baseRightPos.x + exitDx * offset;
        state.rightGear.position.y = state.baseRightPos.y - exitDy * offset;
        state.rightGear.position.z = state.baseRightPos.z;
      }

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
      overscrollProgress = 0;
      state.scrollOffsetProgress = 0;
      state.targetScrollOffsetProgress = 0;

      if (!state.leftGear || !state.rightGear) return;

      state.leftGear.visible = true;
      state.rightGear.visible = true;

      const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);

      const targetLeftX = isMobile ? -0.9 : -8.15;
      const targetRightX = isMobile ? 0.9 : 8.15;

      const targetLeftY = isMobile ? -4.2 : 0.0;
      const targetRightY = isMobile ? -4.0 : 0.0;

      const targetLeftZ = isMobile ? 0.0 : 0.0;
      const targetRightZ = isMobile ? 0.8 : 0.0;

      const startLeftX = isMobile ? -5.5 : -18.0;
      const startRightX = isMobile ? 5.5 : 18.0;

      const gearScale = isMobile ? 0.85 : 2.5;

      // Posição inicial GSAP fora da tela nas laterais
      state.baseLeftPos.set(startLeftX, targetLeftY, targetLeftZ);
      state.baseRightPos.set(startRightX, targetRightY, targetRightZ);

      state.leftGear.scale.set(gearScale, gearScale, gearScale);
      state.rightGear.scale.set(gearScale, gearScale, gearScale);

      // Animação GSAP de Entrada (Aguardar a dobra subir 100% primeiro)
      const tl = gsap.timeline({ delay: isMobile ? 1.8 : 2.3 });

      // 1. As 2 engrenagens deslizam suavemente para as posições de borda
      tl.to(state.baseLeftPos, {
        x: targetLeftX,
        duration: 2.0,
        ease: 'power2.out'
      }, 0);

      tl.to(state.baseRightPos, {
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
          state.scrollOffsetProgress = 0;
          state.targetScrollOffsetProgress = 0;
          if (state.leftGear) state.leftGear.visible = false;
          if (state.rightGear) state.rightGear.visible = false;
          renderer.clear();
        }
      });

      // Roladinha de saída para fora das laterais
      tl.to(state.baseLeftPos, {
        x: startLeftX,
        duration: 0.9,
        ease: 'power2.in'
      }, 0);

      tl.to(state.baseRightPos, {
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
