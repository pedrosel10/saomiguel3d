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
import { setupTeamFold, animateFoldSlideUp, animateFoldSlideDown } from './ui/setupTeamFold.js';

function init() {
  const canvas = document.getElementById('webgl-canvas');
  if (!canvas) return;

  // 1. Configurar Cena, Neblina, Chão e Câmera Isométrica
  const { scene, camera, renderer, floor, shadowFloor, shadowFloorMat, ISOMETRIC_POS, updateResponsiveCamera } = setupScene(canvas);

  // 2. Configurar Iluminação HDRI e Luz Azul Interna
  const lights = setupLights(scene, renderer);

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
  let skeletonUniformsRef = null;
  let callouts = null;

  // Estado para as 2 engrenagens 3D emergentes no eixo central
  const extraGearsState = {
    gear1: null,
    gear2: null,
    active: false,
    isExiting: false,
    gear1Z: 0,
    gear2Z: 0,
    gear1Rotation: 0,
    gear2Rotation: 0,
    centralRotation: 0,
    spinSpeed: 0
  };

  // Objeto de Raycasting e estado de hover para a revelação do Raio-X do Esqueleto
  const hoverRaycaster = new THREE.Raycaster();
  const mouseNDC = new THREE.Vector2();
  const hoverState = {
    isHovered: false,
    progress: 0,
    point: new THREE.Vector3()
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

  window.addEventListener('mousemove', (event) => {
    mouse.targetX = (event.clientX / window.innerWidth - 0.5) * 2;
    mouse.targetY = (event.clientY / window.innerHeight - 0.5) * 2;
  });

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

  window.addEventListener('touchmove', (event) => {
    if (event.touches.length > 0) {
      const touchX = event.touches[0].clientX;
      const touchY = event.touches[0].clientY;

      const deltaY = touchY - touchStartY;

      touchStartX = touchX;
      touchStartY = touchY;

      // Parallax 3D sutil ao mover o dedo
      mouse.targetX = (touchX / window.innerWidth - 0.5) * 2;
      mouse.targetY = (touchY / window.innerHeight - 0.5) * 2;

      // Impulso mecânico no eixo pelo scroll de toque no mobile
      pullState.xVelocity += deltaY * 0.00035;
    }
  }, { passive: true });

  // Listener para sincronizar a inclinação lateral 3D de forma extremamente suave quando o usuário desliza o nível no mobile
  window.addEventListener('levelGaugeDrag', (event) => {
    const { normalizedTarget } = event.detail;
    mouse.targetX = normalizedTarget;
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
    (loadedModel, metadata, gearMaterial, buildUniforms, innerCoreUniforms, skeletonUniforms) => {
      modelState.mesh = loadedModel;
      coreUniformsRef = innerCoreUniforms;
      skeletonUniformsRef = skeletonUniforms;

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

      // Ocultar tela de carregamento e iniciar a sequência de animação 3D de entrada em seguida
      ui.hideLoader(() => {
        // Executar Animações GSAP de Entrada da Câmera, Holograma e Luzes
        setupAnimations(camera, lights, controls, buildUniforms, shadowFloorMat);

        // Revelar as Linhas 3D e os Cards HTML (animação de baixo para cima)
        if (callouts) {
          callouts.animateIn();
        }
      });
    },
    (error) => {
      console.error('Falha ao inicializar o modelo:', error);
      ui.hideLoader();
    }
  );

  // Animação 3D das 2 engrenagens vindo de fora da tela pelo eixo Z central + Contrarrotação
  function triggerEquipeGearAnimation() {
    if (!modelState.mesh) return;

    // Desfazer os cards e linhas holográficas em animação reversa antes de subir a dobra
    if (callouts && callouts.animateOut) {
      callouts.animateOut(0.0);
    }

    if (!extraGearsState.gear1 || !extraGearsState.gear2) {
      const meshSource = modelState.mesh.children[0] || modelState.mesh;
      const g1 = new THREE.Group();
      g1.add(meshSource.clone(true));

      const g2 = new THREE.Group();
      g2.add(meshSource.clone(true));

      g1.visible = false;
      g2.visible = false;

      scene.add(g1);
      scene.add(g2);

      extraGearsState.gear1 = g1;
      extraGearsState.gear2 = g2;
    }

    extraGearsState.active = true;
    extraGearsState.isExiting = false;
    extraGearsState.gear1.visible = true;
    extraGearsState.gear2.visible = true;

    // As engrenagens iniciam fora da tela no eixo Z (uma bem na frente +35.0, outra bem atrás -35.0)
    const OFFSCREEN_FAR_Z = 35.0;
    const TARGET_OFFSET_Z = 2.2;

    extraGearsState.gear1Z = OFFSCREEN_FAR_Z;
    extraGearsState.gear2Z = -OFFSCREEN_FAR_Z;
    extraGearsState.spinSpeed = 0;

    const tl = gsap.timeline();

    // 1. As 2 engrenagens vem de fora da tela ao longo do eixo central Z e param próximo da engrenagem do centro
    tl.to(extraGearsState, {
      gear1Z: TARGET_OFFSET_Z,
      gear2Z: -TARGET_OFFSET_Z,
      duration: 1.6,
      ease: 'power3.out'
    }, 0);

    // 2. Aceleram a rotação em sentidos opostos durante a aproximação
    tl.to(extraGearsState, {
      spinSpeed: 3.8,
      duration: 1.8,
      ease: 'power2.inOut'
    }, 0.1);

    // 3. Após se posicionarem no centro e iniciarem a contrarrotação, dispara a subida da dobra (espera maior)
    tl.add(() => {
      animateFoldSlideUp();
    }, 1.35);
  }

  // Animação 3D de saída das 2 engrenagens voltando para fora da tela
  function triggerEquipeGearExitAnimation() {
    if (!extraGearsState.active || !extraGearsState.gear1 || !extraGearsState.gear2) {
      return;
    }

    // Fazer os cards e linhas reconstruírem-se e reaparecerem na tela inicial
    if (callouts && callouts.animateIn) {
      callouts.animateIn(0.5);
    }

    const OFFSCREEN_FAR_Z = 35.0;

    // Calcular a próxima volta completa (múltiplo exato de 2 * PI) para a engrenagem central parar suavemente na posição inicial
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
      }
    });

    // 1. As 2 engrenagens duplicadas voam de volta para fora da tela enquanto a dobra recolhe
    tl.to(extraGearsState, {
      gear1Z: OFFSCREEN_FAR_Z,
      gear2Z: -OFFSCREEN_FAR_Z,
      duration: 1.5,
      ease: 'power3.in'
    }, 0.4);

    // 2. A velocidade desacelera suavemente até parar e a engrenagem central conclui a volta completa (360°)
    tl.to(extraGearsState, {
      spinSpeed: 0,
      centralRotation: targetCentralRot,
      duration: 1.7,
      ease: 'power2.out'
    }, 0.2);
  }

  // Ouvinte de clique nos cards/callouts para abrir a Seção Equipe
  window.addEventListener('calloutClick', (event) => {
    const data = event.detail;
    if (data && (data.id === 'equipe' || data.id === 'team')) {
      triggerEquipeGearAnimation();
    }
  });

  // Ouvinte para fechar/voltar da Seção Equipe para a experiência 3D hero
  window.addEventListener('calloutClose', (event) => {
    const data = event.detail;
    if (data && (data.id === 'equipe' || data.id === 'team')) {
      animateFoldSlideDown();
      triggerEquipeGearExitAnimation();
    }
  });

  // 6. Redimensionamento de Tela Responsivo
  window.addEventListener('resize', () => {
    updateResponsiveCamera(camera, scene, floor, shadowFloor);

    renderer.setSize(window.innerWidth, window.innerHeight);
    const maxDPR = window.innerWidth <= 768 ? 1.85 : 2.0;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDPR));
  });

  // 7. Loop de Renderização (Animation Loop)
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

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
      extraGearsState.gear1Rotation += delta * extraGearsState.spinSpeed;
      extraGearsState.gear2Rotation -= delta * extraGearsState.spinSpeed;

      // Durante a saída, a rotação central é conduzida suavemente pelo GSAP até a volta completa (360° exato)
      if (!extraGearsState.isExiting) {
        extraGearsState.centralRotation -= delta * (extraGearsState.spinSpeed * 0.6);
      }

      if (extraGearsState.gear1) {
        extraGearsState.gear1.position.set(0, 0, extraGearsState.gear1Z);
        extraGearsState.gear1.rotation.z = extraGearsState.gear1Rotation;
      }
      if (extraGearsState.gear2) {
        extraGearsState.gear2.position.set(0, 0, extraGearsState.gear2Z);
        extraGearsState.gear2.rotation.z = extraGearsState.gear2Rotation;
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

    // Sincronizar em tempo real o indicador do Nível Minimalista com a inclinação 3D no mobile
    if (ui && ui.updateLevelGauge) {
      ui.updateLevelGauge(mouse.x);
    }

    // Raycasting para detectar hover e interseção 3D no modelo (revelação do Raio-X estritamente em Desktop)
    const isMobileDevice = window.innerWidth <= 768 || ('ontouchstart' in window);
    if (!isMobileDevice && modelState.mesh && camera) {
      mouseNDC.set(mouse.targetX, mouse.targetY);
      hoverRaycaster.setFromCamera(mouseNDC, camera);
      const intersects = hoverRaycaster.intersectObject(modelState.mesh, true);
      const meshHit = intersects.find(hit => hit.object.isMesh && hit.object.name !== 'WireframeSkeleton');

      if (meshHit) {
        hoverState.isHovered = true;
        hoverState.point.lerp(meshHit.point, 0.25);
      } else {
        hoverState.isHovered = false;
      }
    }

    // Suavização do indicador de progresso de hover do Raio-X
    hoverState.progress += ((hoverState.isHovered ? 1.0 : 0.0) - hoverState.progress) * 0.12;

    // Atualizar uniforms do shader do esqueleto wireframe
    if (skeletonUniformsRef) {
      skeletonUniformsRef.uHoverProgress.value = hoverState.progress;
      skeletonUniformsRef.uHoverPoint.value.copy(hoverState.point);
      skeletonUniformsRef.uTime.value += delta;
    }

    // Atualizar partículas de faísca
    if (sparksEffect) {
      sparksEffect.update(delta);
    }

    // Atualizar projeções dos Callouts de Seções com reação fluida ao mouse
    if (callouts) {
      callouts.update(delta, mouse);
    }

    // Atualizar OrbitControls
    controls.update();

    // Renderizar Cena
    renderer.render(scene, camera);
  }

  animate();
}

// Iniciar quando o DOM estiver carregado
window.addEventListener('DOMContentLoaded', init);
