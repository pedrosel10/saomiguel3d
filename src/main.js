import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';

import { setupScene } from './scene/setupScene.js';
import { setupLights } from './scene/setupLights.js';
import { loadModel } from './scene/loadModel.js';
import { setupAnimations } from './scene/setupAnimations.js';
import { setupUI } from './ui/setupUI.js';
import { setupSparks } from './effects/setupSparks.js';
import { preloadSmoke } from './effects/landingSmoke.js';
import { setupCallouts } from './ui/setupCallouts.js';
import { setupTeamFold, animateFoldSlideUp, animateFoldSlideDown, showFoldInstant, hideFoldInstant } from './ui/setupTeamFold.js';
import { setupTeamGears } from './scene/setupTeamGears.js';
import { brickTransition } from './effects/brickTransition.js';

function init() {
  const canvas = document.getElementById('webgl-canvas');
  if (!canvas) return;

  // 1. Configurar Cena, Neblina, Chão e Câmera Isométrica
  const { scene, camera, renderer, floor, shadowFloor, shadowFloorMat, ISOMETRIC_POS, updateResponsiveCamera } = setupScene(canvas);

  // 2. Configurar Iluminação HDRI e Luz Azul Interna
  const lights = setupLights(scene, renderer);

  // 2b. Configurar Módulo Dedicado de Engrenagens da Equipe (Câmera Frontal Direta)
  const teamGears = setupTeamGears();

  // 2b. Pré-carregar fumaça 3D (texturas + renderer + warm-up GPU) durante o loading
  preloadSmoke();

  // 3. Câmera com posição 100% fixa (sem navegação de mouse/drag na câmera)
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enableRotate = false; // Desativa rotação da câmera pelo mouse
  controls.enablePan = false;    // Desativa pan/deslocamento da câmera
  controls.enableZoom = false;   // Desativa zoom da câmera
  controls.target.set(0, 0, 0);

  // Estado global do modelo (rotação automática desativada para seguir o mouse)
  const modelState = {
    mesh: null,
    autoRotate: false,
    rotationSpeed: 0.004
  };

  let sparksEffect = null;

  let coreUniformsRef = null;
  let callouts = null;

  let isMainScenePaused = false;

  // Estado para as engrenagens 3D emergentes no eixo central (3 no mobile, 5 no desktop)
  const extraGearsState = {
    gear1: null,
    gear2: null,
    gear3: null,
    gear4: null,
    active: false,
    isExiting: false,
    gear1Z: 0,
    gear2Z: 0,
    gear3Z: 0,
    gear4Z: 0,
    gear1Rotation: 0,
    gear2Rotation: 0,
    gear3Rotation: 0,
    gear4Rotation: 0,
    centralRotation: 0,
    spinSpeed1: 0,
    spinSpeed2: 0,
    spinSpeed3: 0,
    spinSpeed4: 0,
    spinSpeedCentral: 0
  };



  // Estado de deslocamento progressivo de puxar no eixo X pelo scroll
  const pullState = {
    xVelocity: 0,
    xAngle: 0
  };

  // Ao rolar o scroll, puxa a engrenagem com peso mecânico industrial muito denso
  window.addEventListener('wheel', (event) => {
    // Acumula impulso pesado (peso mecânico aumentado)
    pullState.xVelocity += event.deltaY * 0.00018;
  }, { passive: true });

  // Rastreamento da posição do ponteiro do mouse e gestos de touch no mobile
  const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

  let mouseMoveTicking = false;
  window.addEventListener('mousemove', (event) => {
    if (!mouseMoveTicking) {
      mouseMoveTicking = true;
      requestAnimationFrame(() => {
        mouse.targetX = (event.clientX / window.innerWidth - 0.5) * 2;
        mouse.targetY = (event.clientY / window.innerHeight - 0.5) * 2;
        mouseMoveTicking = false;
      });
    }
  }, { passive: true });

  // Suporte a gestos Touch (deslizar o dedo altera o parallax e aciona o impulso mecânico)
  let touchStartX = 0;
  let touchStartY = 0;

  window.addEventListener('touchstart', (event) => {
    if (event.touches.length > 0) {
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;

      mouse.targetX = (touchStartX / window.innerWidth - 0.5) * 2;
      mouse.targetY = (touchStartY / window.innerHeight - 0.5) * 2;
    }
  }, { passive: true });

  let touchMoveTicking = false;
  window.addEventListener('touchmove', (event) => {
    if (event.touches.length > 0 && !touchMoveTicking) {
      touchMoveTicking = true;
      const touchX = event.touches[0].clientX;
      const touchY = event.touches[0].clientY;

      requestAnimationFrame(() => {
        const deltaY = touchY - touchStartY;

        touchStartX = touchX;
        touchStartY = touchY;

        // Parallax 3D sutil ao mover o dedo
        mouse.targetX = (touchX / window.innerWidth - 0.5) * 2;
        mouse.targetY = (touchY / window.innerHeight - 0.5) * 2;

        // Impulso mecânico no eixo pelo scroll de toque no mobile
        pullState.xVelocity += deltaY * 0.00035;
        touchMoveTicking = false;
      });
    }
  }, { passive: true });

  // Listener para pausar o render da cena 3D principal e ativar o render das engrenagens da dobra preta no ponto exato
  window.addEventListener('foldSlideUpComplete', () => {
    isMainScenePaused = true;
    if (teamGears && teamGears.show) {
      teamGears.show();
    }
  });



  // 4. Configurar Interface do Usuário (UI) e Dobra da Equipe
  const ui = setupUI({
    camera,
    controls,
    lights,
    shadowFloorMat,
    modelState,
    defaultCameraPos: ISOMETRIC_POS
  });

  setupTeamFold();

  // 5. Carregar Modelo 3D (smlogo3d.glb)
  loadModel(
    scene,
    (percent) => {
      ui.updateProgress(percent);
    },
    (loadedModel, metadata, gearMaterial, buildUniforms, innerCoreUniforms) => {
      modelState.mesh = loadedModel;
      coreUniformsRef = innerCoreUniforms;

      // Inicializar Sistema de Callout Diagrams saindo de trás do centro da engrenagem
      callouts = setupCallouts(scene, camera, renderer, modelState);

      // Criar o Eixo 3D Central em cor #1A2BC2, ultrafino e elegante
      const axisLength = 140; // Haste estendida no espaço 3D
      const axisLineGeo = new THREE.CylinderGeometry(0.0018, 0.0018, axisLength, 16);
      axisLineGeo.rotateX(Math.PI / 2); // Orientar perfeitamente ao longo do eixo Z central

      const axisLineUniforms = {
        uTime: { value: 0.0 },
        uBuildProgress: { value: 0.0 }
      };

      const axisLineMat = new THREE.ShaderMaterial({
        uniforms: axisLineUniforms,
        transparent: true,
        depthWrite: false, // Previne descarte incorreto de z-buffer
        depthTest: true,
        vertexShader: `
          uniform float uTime;
          uniform float uBuildProgress;
          varying float vZ;
          varying vec3 vWorldPos;
          
          void main() {
            vZ = position.z;
            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uBuildProgress;
          varying float vZ;
          varying vec3 vWorldPos;
          
          void main() {
            // Distância normalizada a partir do centro (0.0 no centro, 1.0 nas pontas a 70u)
            float distFromCenter = abs(vZ) / 70.0;
            
            // Revelação convergente durante a construção
            float threshold = 1.0 - uBuildProgress;
            if (distFromCenter < threshold) {
              discard;
            }

            // Laser verde de construção
            float buildEndFade = smoothstep(1.0, 0.92, uBuildProgress);
            float edgeDist = abs(distFromCenter - threshold);
            float buildGlow = smoothstep(0.08, 0.0, edgeDist) * buildEndFade;

            // Fade suave nas pontas externas
            float edgeFade = smoothstep(1.0, 0.45, distFromCenter);
            
            // ANIMAÇÃO DE ONDA SUAVE (Quase desaparece nos vales ~5% e ressurge até 100% de opacidade)
            // vZ * 0.85 cria ondas longas e uTime * 1.5 movimenta com velocidade reduzida
            float rawWave = sin(vZ * 0.85 - uTime * 1.5) * 0.5 + 0.5; // Curva senoidal ultrassuave de 0.0 a 1.0
            
            // Gradiente continuo: nos vales a linha quase desaparece (5% opacidade) e nos picos atinge 100%
            float waveOpacity = mix(0.05, 1.0, rawWave);

            // Cor 100% pura Azul Royal (Hex #1A2BC2) — sem nenhuma variação de cor
            vec3 axisColor = vec3(0.102, 0.169, 0.761);
            vec3 activeBuildGreenGlow = vec3(0.0, 1.0, 0.55);
            vec3 finalColor = mix(axisColor, activeBuildGreenGlow, buildGlow * 1.5);
            
            // Opacidade final modulada pelo gradiente suave
            float finalAlpha = edgeFade * waveOpacity * (0.95 + buildGlow * 0.05);

            if (finalAlpha < 0.02) discard;

            gl_FragColor = vec4(finalColor, finalAlpha);
          }
        `
      });

      const axisLine = new THREE.Mesh(axisLineGeo, axisLineMat);
      axisLine.userData = { uniforms: axisLineUniforms };
      loadedModel.add(axisLine);

      if (buildUniforms) {
        buildUniforms.axisLineUniforms = axisLineUniforms;
      }

      // Vincular controles de material PBR no lil-gui
      if (gearMaterial) {
        ui.bindMaterialControls(gearMaterial);
      }

      // Inicializar efeito de faíscas de solda incandescentes
      if (buildUniforms) {
        sparksEffect = setupSparks(scene, buildUniforms);
      }

      // Pré-inicializar e pré-compilar no VRAM todas as engrenagens duplicadas e luzes azuis durante a tela de carregamento principal
      const isMobileDevice = window.innerWidth <= 768 || ('ontouchstart' in window);
      const meshSource = loadedModel.children[0] || loadedModel;

      const createInnerBlueLight = () => {
        const light = new THREE.PointLight(0x0066ff, 136.0, 1.5, 2.0);
        light.position.set(-0.2, -0.1, -0.5);
        light.castShadow = false;
        return light;
      };

      const minYVal = buildUniforms ? buildUniforms.uMinY.value : -2.0;
      const maxYVal = buildUniforms ? buildUniforms.uMaxY.value : 2.5;

      const extraClipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), maxYVal);

      // Uniforms para a varredura laser holográfica de construção das engrenagens extras (sem faíscas)
      const extraBuildUniforms = {
        clipPlane: extraClipPlane,
        uBuildProgress: { value: 1.0 },
        uMinY: { value: minYVal },
        uMaxY: { value: maxYVal }
      };

      // Material simplificado e ultra-leve com suporte ao laser holográfico de varredura
      const extraGearMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#051b42'),
        map: gearMaterial.map,
        normalMap: gearMaterial.normalMap,
        normalScale: new THREE.Vector2(1.0, 1.0),
        roughnessMap: gearMaterial.roughnessMap,
        metalnessMap: gearMaterial.metalnessMap,
        metalness: 0.95,
        roughness: 0.35,
        envMapIntensity: 1.2,
        clippingPlanes: [extraClipPlane],
        clipShadows: true,
        side: THREE.DoubleSide
      });

      extraGearMat.onBeforeCompile = (shader) => {
        shader.uniforms.uBuildProgress = extraBuildUniforms.uBuildProgress;
        shader.uniforms.uMinY = extraBuildUniforms.uMinY;
        shader.uniforms.uMaxY = extraBuildUniforms.uMaxY;

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
            if (dist > 0.0 && dist < 0.60) {
              float glow = smoothstep(0.60, 0.0, dist);
              vec3 cyanGlow = vec3(0.0, 0.75, 1.0);
              float hLines = step(0.65, sin(vWorldPosition.y * 120.0));
              float vLines = step(0.70, sin(vWorldPosition.x * 90.0) * sin(vWorldPosition.z * 90.0));
              float grid = max(hLines, vLines);
              float scanEdge = smoothstep(0.08, 0.0, dist);
              float endFade = smoothstep(1.0, 0.92, uBuildProgress);
              
              gl_FragColor.rgb = mix(
                gl_FragColor.rgb, 
                cyanGlow * 4.0, 
                (glow * 0.4 + grid * glow * 0.7 + scanEdge * 0.9) * endFade
              );
            }
          }
          `
        );
      };

      const cloneExtraMesh = (source) => {
        const clone = source.clone(true);
        clone.traverse(child => {
          if (child.isMesh) {
            child.material = extraGearMat;
            child.castShadow = false;
            child.receiveShadow = false;
          }
        });
        return clone;
      };

      if (!extraGearsState.gear1) {
        const g1 = new THREE.Group();
        g1.add(cloneExtraMesh(meshSource));
        g1.add(createInnerBlueLight());
        g1.visible = false;
        scene.add(g1);
        extraGearsState.gear1 = g1;
      }

      if (!extraGearsState.gear2) {
        const g2 = new THREE.Group();
        g2.add(cloneExtraMesh(meshSource));
        g2.add(createInnerBlueLight());
        g2.visible = false;
        scene.add(g2);
        extraGearsState.gear2 = g2;
      }

      if (!isMobileDevice) {
        if (!extraGearsState.gear3) {
          const g3 = new THREE.Group();
          g3.add(cloneExtraMesh(meshSource));
          g3.add(createInnerBlueLight());
          g3.visible = false;
          scene.add(g3);
          extraGearsState.gear3 = g3;
        }
        if (!extraGearsState.gear4) {
          const g4 = new THREE.Group();
          g4.add(cloneExtraMesh(meshSource));
          g4.add(createInnerBlueLight());
          g4.visible = false;
          scene.add(g4);
          extraGearsState.gear4 = g4;
        }
      }

      // Inicializar engrenagens 3D com visão frontal direta no canvas dedicado da equipe
      if (teamGears && teamGears.initGears) {
        teamGears.initGears(loadedModel.children[0] || loadedModel);
      }

      // Guardar referência global dos uniforms do laser extra
      extraGearsState.extraBuildUniforms = extraBuildUniforms;

      // Ocultar tela de carregamento e iniciar a sequência de animação 3D de entrada
      ui.hideLoader(() => {
        requestAnimationFrame(() => {
          setupAnimations(camera, lights, controls, buildUniforms, shadowFloorMat);
          if (callouts) {
            callouts.animateIn();
          }
        });
      });
    },
    (error) => {
      console.error('Falha ao inicializar o modelo:', error);
      ui.hideLoader();
    }
  );

  // Animação 3D das engrenagens com varredura laser holográfica na entrada (sem faíscas)
  function triggerEquipeGearAnimation(targetSectionId = 'team') {
    if (!modelState.mesh) return;

    const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);



    // Desfazer os cards e linhas holográficas em animação reversa antes de subir a dobra
    if (callouts && callouts.animateOut) {
      callouts.animateOut(0.0);
    }

    extraGearsState.active = true;
    extraGearsState.isExiting = false;

    const TARGET_OFFSET_Z1 = isMobile ? 1.3 : 1.2; // Espaçamento 20% mais próximo (+1.2u)
    const TARGET_OFFSET_Z2 = 2.4;                  // Espaçamento 20% mais próximo (+2.4u)

    // Posicionar as engrenagens diretamente no eixo no local exato de destino
    extraGearsState.gear1Z = TARGET_OFFSET_Z1;
    extraGearsState.gear2Z = -TARGET_OFFSET_Z1;
    extraGearsState.gear3Z = TARGET_OFFSET_Z2;
    extraGearsState.gear4Z = -TARGET_OFFSET_Z2;

    if (extraGearsState.gear1) {
      extraGearsState.gear1.position.z = TARGET_OFFSET_Z1;
      extraGearsState.gear1.visible = true;
    }
    if (extraGearsState.gear2) {
      extraGearsState.gear2.position.z = -TARGET_OFFSET_Z1;
      extraGearsState.gear2.visible = true;
    }

    if (!isMobile && extraGearsState.gear3 && extraGearsState.gear4) {
      extraGearsState.gear3.position.z = TARGET_OFFSET_Z2;
      extraGearsState.gear3.visible = true;
      extraGearsState.gear4.position.z = -TARGET_OFFSET_Z2;
      extraGearsState.gear4.visible = true;
    }

    // Função para atualizar a intensidade das luzes azuis internas
    const setInnerLightsIntensity = (intensity) => {
      [extraGearsState.gear1, extraGearsState.gear2, extraGearsState.gear3, extraGearsState.gear4].forEach(group => {
        if (group) {
          group.traverse(child => {
            if (child.isPointLight) {
              child.intensity = intensity;
            }
          });
        }
      });
    };

    // Resetar corte do plano, progresso do laser e intensidade da luz azul para 0.0 (sem piscar)
    setInnerLightsIntensity(0.0);

    if (extraGearsState.extraBuildUniforms && extraGearsState.extraBuildUniforms.clipPlane) {
      const minY = extraGearsState.extraBuildUniforms.uMinY.value;
      extraGearsState.extraBuildUniforms.clipPlane.constant = minY;
      extraGearsState.extraBuildUniforms.uBuildProgress.value = 0.0;
    }

    extraGearsState.spinSpeed1 = 0;
    extraGearsState.spinSpeed2 = 0;
    extraGearsState.spinSpeed3 = 0;
    extraGearsState.spinSpeed4 = 0;
    extraGearsState.spinSpeedCentral = 0;

    isMainScenePaused = false;
    const tl = gsap.timeline();

    // Fade-in suave da luz azul interna com delay para acender só quando o laser atingir o centro
    const lightFadeObj = { intensity: 0.0 };
    tl.to(lightFadeObj, {
      intensity: 136.0,
      duration: isMobile ? 1.2 : 1.5,
      ease: 'power2.out',
      onUpdate: () => {
        setInnerLightsIntensity(lightFadeObj.intensity);
      }
    }, 0.6);

    // 1. Animação de varredura laser revelando as engrenagens extras de 0% a 100% (de baixo para cima)
    if (extraGearsState.extraBuildUniforms && extraGearsState.extraBuildUniforms.clipPlane) {
      const maxY = extraGearsState.extraBuildUniforms.uMaxY.value;
      const buildDuration = isMobile ? 1.6 : 2.2;

      tl.to(extraGearsState.extraBuildUniforms.clipPlane, {
        constant: maxY,
        duration: buildDuration,
        ease: 'power2.inOut'
      }, 0);

      tl.to(extraGearsState.extraBuildUniforms.uBuildProgress, {
        value: 1.0,
        duration: buildDuration,
        ease: 'power2.inOut'
      }, 0);
    }

    const TARGET_SPIN = isMobile ? 2.0 : 2.5;

    // 2. EFEITO DE ONDA: Aguarda o preenchimento laser e inicia o giro em onda DA ÚLTIMA ATÉ A PRIMEIRA
    if (isMobile) {
      tl.to(extraGearsState, {
        spinSpeed2: TARGET_SPIN,
        spinSpeedCentral: TARGET_SPIN,
        spinSpeed1: TARGET_SPIN,
        duration: 1.2,
        ease: 'power2.inOut'
      }, 0.8);
    } else {
      const WAVE_START_TIME = 0.9;
      const STEP = 0.16;

      // Da última (gear4 no fundo) até a primeira (gear3 na frente)
      tl.to(extraGearsState, { spinSpeed4: TARGET_SPIN, duration: 1.2, ease: 'power2.out' }, WAVE_START_TIME);
      tl.to(extraGearsState, { spinSpeed2: TARGET_SPIN, duration: 1.2, ease: 'power2.out' }, WAVE_START_TIME + STEP);
      tl.to(extraGearsState, { spinSpeedCentral: TARGET_SPIN, duration: 1.2, ease: 'power2.out' }, WAVE_START_TIME + STEP * 2);
      tl.to(extraGearsState, { spinSpeed1: TARGET_SPIN, duration: 1.2, ease: 'power2.out' }, WAVE_START_TIME + STEP * 3);
      tl.to(extraGearsState, { spinSpeed3: TARGET_SPIN, duration: 1.2, ease: 'power2.out' }, WAVE_START_TIME + STEP * 4);
    }

    // 3. Dispara a transição universal de tijolos para todas as dobras (Serviços, Clientes, Contato, Equipe)
    const delayBeforeBricks = isMobile ? 1.3 : 1.6;

    tl.add(() => {
      brickTransition.startTransition(
        () => {
          // No momento em que o muro de tijolos cobre 100% da tela:
          showFoldInstant(targetSectionId);
        },
        () => {
          // Muro de tijolos desfeito totalmente
        }
      );
    }, delayBeforeBricks);
  }

  // Animação 3D de saída sequencial das engrenagens e transição de tijolos
  function triggerEquipeGearExitAnimation(activeSectionId = 'team') {
    const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);

    const runGearRetreat = () => {
      // 1. Reativar o render da cena 3D principal (Cena 1)
      isMainScenePaused = false;

      if (callouts && callouts.animateIn) {
        callouts.animateIn(isMobile ? 0.2 : 0.5);
      }

      const OFFSCREEN_FAR_Z1 = isMobile ? 14.0 : 35.0;
      const OFFSCREEN_FAR_Z2 = 55.0;

      const TWO_PI = Math.PI * 2;
      const currentRot = extraGearsState.centralRotation;
      const targetCentralRot = Math.round(currentRot / TWO_PI) * TWO_PI;

      extraGearsState.isExiting = true;

      const tl = gsap.timeline({
        onComplete: () => {
          extraGearsState.active = false;
          extraGearsState.isExiting = false;
          extraGearsState.centralRotation = 0;
          if (extraGearsState.gear1) extraGearsState.gear1.visible = false;
          if (extraGearsState.gear2) extraGearsState.gear2.visible = false;
          if (extraGearsState.gear3) extraGearsState.gear3.visible = false;
          if (extraGearsState.gear4) extraGearsState.gear4.visible = false;
        }
      });

      const exitObj = {
        gear1Z: OFFSCREEN_FAR_Z1,
        gear2Z: -OFFSCREEN_FAR_Z1,
        duration: isMobile ? 1.0 : 1.5,
        ease: 'power3.in'
      };

      if (!isMobile) {
        exitObj.gear3Z = OFFSCREEN_FAR_Z2;
        exitObj.gear4Z = -OFFSCREEN_FAR_Z2;
      }

      tl.to(extraGearsState, exitObj, isMobile ? 0.2 : 0.4);

      tl.to(extraGearsState, {
        spinSpeed1: 0,
        spinSpeed2: 0,
        spinSpeed3: 0,
        spinSpeed4: 0,
        spinSpeedCentral: 0,
        centralRotation: targetCentralRot,
        duration: isMobile ? 1.2 : 1.7,
        ease: 'power2.out'
      }, isMobile ? 0.1 : 0.2);
    };

    // 1. Inicia a construção da parede de tijolos imediatamente sobre a dobra ativa (Serviços, Clientes, Contato ou Equipe)
    brickTransition.startTransition(
      () => {
        // 2. Quando o muro de tijolos fecha 100% cobrindo a tela:
        // Desativa a dobra ativa e as engrenagens laterais e ativa a cena 1
        hideFoldInstant(activeSectionId);
        if (teamGears && teamGears.hideInstant) {
          teamGears.hideInstant();
        }
        runGearRetreat();
      },
      () => {
        // 3. Muro desfeito totalmente revelando a Cena 1 pronta
      }
    );
  }

  // Mapeamento dos IDs dos Callouts de 3D para as Seções das Dobras
  const foldIdMap = {
    'equipe': 'team',
    'team': 'team',
    'servicos': 'servicos',
    'cases': 'clientes',
    'clientes': 'clientes',
    'contato': 'contato'
  };

  // Ouvinte de clique nos cards/callouts para abrir qualquer uma das 4 dobras
  window.addEventListener('calloutClick', (event) => {
    const data = event.detail;
    if (data && data.id) {
      const sectionId = foldIdMap[data.id] || data.id;
      triggerEquipeGearAnimation(sectionId);
    }
  });

  // Ouvinte para fechar/voltar de qualquer dobra para a experiência 3D hero
  window.addEventListener('calloutClose', (event) => {
    const data = event.detail;
    if (data && data.id) {
      const sectionId = foldIdMap[data.id] || data.id;
      triggerEquipeGearExitAnimation(sectionId);
    }
  });

  // 6. Redimensionamento de Tela Responsivo
  window.addEventListener('resize', () => {
    updateResponsiveCamera(camera, scene, floor, shadowFloor);

    const isMobileDevice = window.innerWidth <= 768 || ('ontouchstart' in window);
    const maxDPR = isMobileDevice ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 1.5);
    renderer.setPixelRatio(maxDPR);
  });

  // 7. Loop de Renderização (Animation Loop)
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // Se a cena principal estiver pausada (ex: navegando dentro de uma dobra), suspende 100% do processamento para economizar GPU/CPU
    if (isMainScenePaused) {
      return;
    }

    // Inclinação no eixo Y e X guiadas de forma ultrassuave e sutil pelo movimento (lerp 4.5%)
    mouse.x += (mouse.targetX - mouse.x) * 0.045;
    mouse.y += (mouse.targetY - mouse.y) * 0.045;

    // Limite máximo de 30% de rotação (aprox ±0.33 rad / ~19 graus)
    const MAX_ROTATION_30_PERCENT = 0.33;

    // Calcular resistência elástica progressiva (quanto mais perto do limite, mais pesado fica)
    const normalizedPos = Math.abs(pullState.xAngle) / MAX_ROTATION_30_PERCENT; // 0.0 a 1.0
    const resistance = Math.pow(1.0 - Math.min(normalizedPos, 0.99), 1.8); // Fator de amortecimento progressivo

    // Aplicar velocidade ponderada pela resistência
    pullState.xAngle += pullState.xVelocity * resistance;
    pullState.xVelocity *= 0.92; // Fricção fluida ultrassuave

    // Mola de retorno elástico suave cadenciado
    pullState.xAngle += (0 - pullState.xAngle) * 0.045;

    // Trava física suave (Soft Clamp)
    pullState.xAngle = THREE.MathUtils.clamp(pullState.xAngle, -MAX_ROTATION_30_PERCENT, MAX_ROTATION_30_PERCENT);

    // Movimento orbital dinâmico da CÂMERA reagindo ao mouse (movimento sutil e elegante do cenário 3D)
    if (camera.userData && camera.userData.basePosition && camera.userData.isIntroComplete) {
      // Suavização do peso do mouse (0.0 -> 1.0) para eliminar totalmente qualquer pulo pós-carregamento
      if (camera.userData.mouseWeight === undefined) camera.userData.mouseWeight = 0.0;
      camera.userData.mouseWeight += (1.0 - camera.userData.mouseWeight) * 0.04;

      const weight = camera.userData.mouseWeight;
      const basePos = camera.userData.basePosition;
      const camPos = basePos.clone();

      // Rotação orbital sutil da câmera (~3.4° max no eixo Y)
      camPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), mouse.x * 0.06 * weight);

      // Deslocamento de altura sutil (~0.12u max no eixo Y)
      camPos.y += mouse.y * 0.12 * weight;

      camera.position.copy(camPos);
      camera.lookAt(0, 0, 0);
    }



    if (extraGearsState.active) {
      const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);

      // TODAS as engrenagens giram para o MESMO LADO (+Z)
      extraGearsState.gear1Rotation += delta * extraGearsState.spinSpeed1;
      extraGearsState.gear2Rotation += delta * extraGearsState.spinSpeed2;

      if (!isMobile) {
        extraGearsState.gear3Rotation += delta * extraGearsState.spinSpeed3;
        extraGearsState.gear4Rotation += delta * extraGearsState.spinSpeed4;
      }

      // Durante a saída, a rotação central é conduzida suavemente pelo GSAP até a volta completa (360° exato)
      if (!extraGearsState.isExiting) {
        extraGearsState.centralRotation += delta * extraGearsState.spinSpeedCentral;
      }

      if (extraGearsState.gear1) {
        extraGearsState.gear1.position.set(0, 0, extraGearsState.gear1Z);
        extraGearsState.gear1.rotation.z = extraGearsState.gear1Rotation;
      }
      if (extraGearsState.gear2) {
        extraGearsState.gear2.position.set(0, 0, extraGearsState.gear2Z);
        extraGearsState.gear2.rotation.z = extraGearsState.gear2Rotation;
      }
      if (!isMobile) {
        if (extraGearsState.gear3) {
          extraGearsState.gear3.position.set(0, 0, extraGearsState.gear3Z);
          extraGearsState.gear3.rotation.z = extraGearsState.gear3Rotation;
        }
        if (extraGearsState.gear4) {
          extraGearsState.gear4.position.set(0, 0, extraGearsState.gear4Z);
          extraGearsState.gear4.rotation.z = extraGearsState.gear4Rotation;
        }
      }
    }

    if (modelState.mesh) {
      // O modelo agora não gira sozinho no eixo Y; a câmera que orbita todo o mundo 3D
      modelState.mesh.rotation.y = 0;

      // Rotação no eixo Z com suporte à contrarrotação da animação da equipe
      const rollAngle = pullState.xAngle * 1.5;
      modelState.mesh.rotation.z = extraGearsState.active
        ? (extraGearsState.centralRotation - rollAngle)
        : -rollAngle;

      // Posição estritamente estática no centro do espaço
      modelState.mesh.position.set(0, 0, 0);
    }

    // Atualizar o deslocamento no eixo X do anel central no shader
    if (coreUniformsRef) {
      coreUniformsRef.uCoreRotationX.value = pullState.xAngle;
    }



    // Atualizar partículas de faísca (Apenas quando a cena 3D principal não estiver pausada)
    if (sparksEffect && !isMainScenePaused) {
      sparksEffect.update(delta);
    }

    // Atualizar projeções dos Callouts de Seções com reação fluida ao mouse
    if (callouts) {
      callouts.update(delta, mouse);
    }

    // Atualizar OrbitControls
    controls.update();

    // Renderizar Cena 3D Principal (Apenas quando visível para economizar GPU)
    if (!isMainScenePaused) {
      renderer.render(scene, camera);
    }
  }

  animate();
}

// Iniciar quando o DOM estiver carregado
window.addEventListener('DOMContentLoaded', init);
