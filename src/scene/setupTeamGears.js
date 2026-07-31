import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
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

  // 3. Renderer Dedicado no Canvas da Equipe com Alta Precisao e Antialiasing
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
    precision: 'highp'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(1.5); // Estado inicial = DPR 1.5 (gerenciado dinamicamente pelo adaptiveDPR)
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;

  // 4. Carregar o Mapa de Iluminação de Estúdio HDRI idêntico ao da Cena 1
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  new RGBELoader().load('./obj3D/ferndale_studio_01_1k.hdr', (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    const envMap = pmrem.fromEquirectangular(texture).texture;
    scene.environment = envMap;
    texture.dispose();
    pmrem.dispose();
  });

  // 5. Iluminação Fiel à Cena 1 com Ponto Azul Interno
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);

  const frontLight = new THREE.DirectionalLight(0xe0f2fe, 10.0);
  frontLight.position.set(0, 2, 8);
  scene.add(frontLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
  keyLight.position.set(4.0, 8.0, 6.0);
  scene.add(keyLight);

  const createInnerBlueLight = () => {
    const light = new THREE.PointLight(0x0066ff, 350.0, 6.0, 1.5);
    light.position.set(-0.2, -0.1, -0.5);
    return light;
  };

  // 6. Estado Interno do Módulo
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

  // Plano de corte e uniforms para a varredura holográfica em laser das engrenagens laterais
  const teamClipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 8.0);

  const teamBuildUniforms = {
    clipPlane: teamClipPlane,
    uBuildProgress: { value: 1.0 },
    uMinY: { value: -8.0 },
    uMaxY: { value: 8.0 }
  };

  let teamGearMat = null;

  // Função utilitária para clonar o modelo 3D com o material do laser de varredura
  const cloneCleanMesh = (source) => {
    if (!teamGearMat && source) {
      // Reutilizar mapas de textura do modelo original
      let origMat = null;
      source.traverse(child => {
        if (child.isMesh && child.material && child.material.map) {
          origMat = child.material;
        }
      });

      teamGearMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#051b42'),
        map: origMat ? origMat.map : null,
        normalMap: origMat ? origMat.normalMap : null,
        normalScale: new THREE.Vector2(2.0, 2.0),
        roughnessMap: origMat ? origMat.roughnessMap : null,
        metalnessMap: origMat ? origMat.metalnessMap : null,
        metalness: 0.98,
        roughness: 0.30,
        clearcoat: 0.5,
        clearcoatRoughness: 0.2,
        envMapIntensity: 1.6,
        clippingPlanes: [teamClipPlane],
        clipShadows: true,
        side: THREE.DoubleSide
      });

      teamGearMat.onBeforeCompile = (shader) => {
        shader.uniforms.uBuildProgress = teamBuildUniforms.uBuildProgress;
        shader.uniforms.uMinY = teamBuildUniforms.uMinY;
        shader.uniforms.uMaxY = teamBuildUniforms.uMaxY;

        shader.vertexShader = `
          varying vec3 vWorldPosition;
          ${shader.vertexShader}
        `.replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
          `
        );

        shader.fragmentShader = `
          uniform float uBuildProgress;
          uniform float uMinY;
          uniform float uMaxY;
          varying vec3 vWorldPosition;
          ${shader.fragmentShader}
        `.replace(
          '#include <dithering_fragment>',
          `
          #include <dithering_fragment>
          float buildHeight = mix(uMinY, uMaxY, uBuildProgress);
          
          if (uBuildProgress < 1.0) {
            float dist = buildHeight - vWorldPosition.y;
            float scanWidth = 0.25;
            if (dist > 0.0 && dist < scanWidth) {
              float glow = smoothstep(scanWidth, 0.0, dist);
              vec3 cyanGlow = vec3(0.0, 0.75, 1.0);
              float hLines = step(0.65, sin(vWorldPosition.y * 150.0));
              float vLines = step(0.70, sin(vWorldPosition.x * 110.0) * sin(vWorldPosition.z * 110.0));
              float grid = max(hLines, vLines);
              float scanEdge = smoothstep(0.04, 0.0, dist);
              float endFade = smoothstep(1.0, 0.92, uBuildProgress);
              
              gl_FragColor.rgb = mix(
                gl_FragColor.rgb, 
                cyanGlow * 3.5, 
                (glow * 0.3 + grid * glow * 0.5 + scanEdge * 0.8) * endFade
              );
            }
          }
          `
        );
      };
    }

    const clone = source.clone(true);
    const toRemove = [];
    clone.traverse((child) => {
      if (child.name === 'WireframeSkeleton') {
        toRemove.push(child);
      } else if (child.isMesh) {
        if (teamGearMat) child.material = teamGearMat;
        child.castShadow = false;
        child.receiveShadow = false;
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

    state.teamBuildUniforms = teamBuildUniforms;

    // Engrenagem Esquerda (Visão Frontal - Sem malhas de wireframe/hover)
    const gL = new THREE.Group();
    const cleanL = cloneCleanMesh(sourceMesh);
    gL.add(cleanL);
    gL.add(createInnerBlueLight());
    scene.add(gL);

    // Engrenagem Direita (Visão Frontal - Sem malhas de wireframe/hover)
    const gR = new THREE.Group();
    const cleanR = cloneCleanMesh(sourceMesh);
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

    const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);
    const maxDPR = isMobile ? 2.5 : Math.min(window.devicePixelRatio || 1, 2.5);
    renderer.setPixelRatio(maxDPR);

    updateGearPositions();
  });

  // 7. Ouvinte de Scroll nas Dobras (.section.mod--about)
  const MAX_SCROLL_SPEED = 0.025; // Teto de velocidade máxima de giro por scroll
  const clampSpeed = (val) => Math.max(-MAX_SCROLL_SPEED, Math.min(MAX_SCROLL_SPEED, val));

  const updateScrollOffset = (activeSection) => {
    if (!activeSection || !state.active) return;
    const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);
    if (!isMobile) {
      state.targetScrollOffsetProgress = 0;
      return;
    }

    const scrollableDistance = activeSection.scrollHeight - activeSection.clientHeight;

    // Se a dobra couber na tela (sem scroll relevante), as engrenagens devem permanecer visíveis
    if (scrollableDistance <= 20) {
      state.targetScrollOffsetProgress = 0.0;
      return;
    }

    const maxScroll = scrollableDistance;
    const currentScroll = activeSection.scrollTop;

    // Quando chega no limite inferior do scroll da dobra, as engrenagens saem da tela
    if (currentScroll >= maxScroll - 12) {
      state.targetScrollOffsetProgress = 1.0;
    } else if (currentScroll < maxScroll - 30) {
      // Quando rola para cima saindo do fim da dobra, as engrenagens retornam
      state.targetScrollOffsetProgress = 0.0;
    }
  };

  const foldSections = document.querySelectorAll('.section.fold-section');
  foldSections.forEach(section => {
    let lastSectionScrollTop = 0;
    let touchStartY = 0;

    section.addEventListener('scroll', () => {
      if (!state.active) return;
      updateScrollOffset(section);
      const currentScrollTop = section.scrollTop;
      const deltaY = currentScrollTop - lastSectionScrollTop;
      lastSectionScrollTop = currentScrollTop;

      state.scrollVelocity = clampSpeed(state.scrollVelocity + deltaY * 0.0005);
    }, { passive: true });

    section.addEventListener('wheel', (event) => {
      if (!state.active) return;
      updateScrollOffset(section);
      state.scrollVelocity = clampSpeed(state.scrollVelocity + event.deltaY * 0.00035);
    }, { passive: true });

    section.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) touchStartY = e.touches[0].clientY;
    }, { passive: true });

    section.addEventListener('touchmove', (e) => {
      if (!state.active || e.touches.length === 0) return;
      updateScrollOffset(section);
      const touchY = e.touches[0].clientY;
      const deltaY = touchStartY - touchY;
      touchStartY = touchY;

      state.scrollVelocity = clampSpeed(state.scrollVelocity + deltaY * 0.0006);
    }, { passive: true });
  });

  // 8. Loop de Renderização da Câmera Frontal (Otimizado: Pausa total quando inativo)
  const clock = new THREE.Clock();
  let animId = null;

  const stopLoop = () => {
    if (animId !== null) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  };

  const startLoop = () => {
    if (animId === null && state.active) {
      clock.getDelta();
      renderLoop();
    }
  };

  const renderLoop = () => {
    if (!state.active) {
      stopLoop();
      return;
    }

    const delta = clock.getDelta();
    const slowSpin = delta * 0.35; // Rotação ambiente contínua suave

    state.rotLeft += slowSpin + state.scrollVelocity * 0.4;
    state.rotRight -= (slowSpin + state.scrollVelocity * 0.4);
    state.scrollVelocity *= 0.90; // Fricção fluida

    const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);

    // Lerp ultra-suave e cadenciado do deslocamento de saída no limite
    const lerpFactor = isMobile ? 0.038 : 0.08;
    state.scrollOffsetProgress += (state.targetScrollOffsetProgress - state.scrollOffsetProgress) * lerpFactor;

    const exitDx = 0.0; // Não move para as laterais no mobile
    const exitDy = isMobile ? 0.9 : 0.0; // Abaixa apenas cerca de 30% permanecendo visível na tela
    const offset = isMobile ? state.scrollOffsetProgress : 0.0;

    if (state.leftGear) {
      state.leftGear.rotation.z = state.rotLeft;
      state.leftGear.position.x = state.baseLeftPos.x;
      state.leftGear.position.y = state.baseLeftPos.y - exitDy * offset;
      state.leftGear.position.z = state.baseLeftPos.z;
    }

    if (state.rightGear) {
      state.rightGear.rotation.z = state.rotRight;
      state.rightGear.position.x = state.baseRightPos.x;
      state.rightGear.position.y = state.baseRightPos.y - exitDy * offset;
      state.rightGear.position.z = state.baseRightPos.z;
    }

    renderer.render(scene, camera);
    animId = requestAnimationFrame(renderLoop);
  };

  return {
    initGears,
    show: () => {
      state.active = true;
      state.scrollVelocity = 0;
      state.scrollOffsetProgress = 0;
      state.targetScrollOffsetProgress = 0;
      startLoop();

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

      // Garante posições sincronizadas exatas antes de ativar a visibilidade
      state.baseLeftPos.set(targetLeftX, targetLeftY, targetLeftZ);
      state.baseRightPos.set(targetRightX, targetRightY, targetRightZ);

      state.leftGear.position.copy(state.baseLeftPos);
      state.rightGear.position.copy(state.baseRightPos);
      state.leftGear.rotation.z = state.rotLeft;
      state.rightGear.rotation.z = state.rotRight;

      state.leftGear.scale.set(gearScale, gearScale, gearScale);
      state.rightGear.scale.set(gearScale, gearScale, gearScale);

      state.leftGear.visible = true;
      state.rightGear.visible = true;

      // Função para atualizar a intensidade da luz azul interna das engrenagens laterais
      const setTeamInnerLights = (val) => {
        [state.leftGear, state.rightGear].forEach(group => {
          if (group) {
            group.traverse(child => {
              if (child.isPointLight) child.intensity = val;
            });
          }
        });
      };

      setTeamInnerLights(0.0);

      const minY = -6.0;
      const maxY = 6.0;

      if (state.teamBuildUniforms && state.teamBuildUniforms.clipPlane) {
        state.teamBuildUniforms.uMinY.value = minY;
        state.teamBuildUniforms.uMaxY.value = maxY;
        state.teamBuildUniforms.clipPlane.constant = minY;
        state.teamBuildUniforms.uBuildProgress.value = 0.0;
      }

      // Animação de construção laser holográfica de baixo para cima (sem rolamento)
      const tl = gsap.timeline({ delay: 0 });
      const buildDuration = isMobile ? 3.5 : 1.8;

      const lightObj = { intensity: 0.0 };
      tl.to(lightObj, {
        intensity: 160.0,
        duration: isMobile ? 2.0 : 1.0,
        ease: 'power2.out',
        onUpdate: () => {
          setTeamInnerLights(lightObj.intensity);
        }
      }, isMobile ? 1.0 : 0.4);

      if (state.teamBuildUniforms && state.teamBuildUniforms.clipPlane) {
        tl.to(state.teamBuildUniforms.clipPlane, {
          constant: maxY,
          duration: buildDuration,
          ease: 'power2.inOut'
        }, 0);

        tl.to(state.teamBuildUniforms.uBuildProgress, {
          value: 1.0,
          duration: buildDuration,
          ease: 'power2.inOut'
        }, 0);
      }
    },
    hide: (onCompleteCallback) => {
      if (!state.leftGear || !state.rightGear) {
        state.active = false;
        if (onCompleteCallback) onCompleteCallback();
        return;
      }

      const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);
      const targetLeftX = isMobile ? -0.9 : -8.15;
      const targetRightX = isMobile ? 0.9 : 8.15;
      const startLeftX = isMobile ? -5.5 : -18.0;
      const startRightX = isMobile ? 5.5 : 18.0;

      const exitDuration = isMobile ? 0.8 : 0.6;
      const exitEase = 'power2.in';

      const tl = gsap.timeline({
        onComplete: () => {
          state.active = false;
          state.scrollOffsetProgress = 0;
          state.targetScrollOffsetProgress = 0;
          if (state.leftGear) {
            state.leftGear.visible = false;
            state.baseLeftPos.x = targetLeftX;
            state.leftGear.position.x = targetLeftX;
          }
          if (state.rightGear) {
            state.rightGear.visible = false;
            state.baseRightPos.x = targetRightX;
            state.rightGear.position.x = targetRightX;
          }
          renderer.clear();
          if (onCompleteCallback) onCompleteCallback();
        }
      });

      tl.to(state.baseLeftPos, {
        x: startLeftX,
        duration: exitDuration,
        ease: exitEase
      }, 0);

      tl.to(state.baseRightPos, {
        x: startRightX,
        duration: exitDuration,
        ease: exitEase
      }, 0);

      tl.to(state, {
        scrollVelocity: 0,
        duration: exitDuration,
        ease: 'sine.out'
      }, 0);
    },
    hideInstant: () => {
      state.active = false;
      state.scrollOffsetProgress = 0;
      state.targetScrollOffsetProgress = 0;
      const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);
      const targetLeftX = isMobile ? -0.9 : -8.15;
      const targetRightX = isMobile ? 0.9 : 8.15;
      if (state.leftGear) {
        state.leftGear.visible = false;
        state.baseLeftPos.x = targetLeftX;
        state.leftGear.position.x = targetLeftX;
      }
      if (state.rightGear) {
        state.rightGear.visible = false;
        state.baseRightPos.x = targetRightX;
        state.rightGear.position.x = targetRightX;
      }
      renderer.clear();
    },
    renderer
  };
}
