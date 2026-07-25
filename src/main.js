import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { setupScene } from './scene/setupScene.js';
import { setupLights } from './scene/setupLights.js';
import { loadModel } from './scene/loadModel.js';
import { setupAnimations } from './scene/setupAnimations.js';
import { setupUI } from './ui/setupUI.js';
import { setupSparks } from './effects/setupSparks.js';
import { setupCallouts } from './ui/setupCallouts.js';

function init() {
  const canvas = document.getElementById('webgl-canvas');
  if (!canvas) return;

  // 1. Configurar Cena, Neblina, Chão e Câmera Isométrica
  const { scene, camera, renderer, floor, shadowFloorMat, ISOMETRIC_POS, updateResponsiveCamera } = setupScene(canvas);

  // 2. Configurar Iluminação HDRI e Luz Azul Interna
  const lights = setupLights(scene, renderer);

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

  // Rastreamento da posição do ponteiro do mouse
  const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
  window.addEventListener('mousemove', (event) => {
    mouse.targetX = (event.clientX / window.innerWidth - 0.5) * 2;
    mouse.targetY = (event.clientY / window.innerHeight - 0.5) * 2;
  });

  // 4. Configurar Interface do Usuário (UI)
  const ui = setupUI({
    camera,
    controls,
    lights,
    shadowFloorMat,
    modelState,
    defaultCameraPos: ISOMETRIC_POS
  });

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

      // Criar a Linha do Eixo 3D Infinita com Fade nas pontas e Pulsação Dinâmica Viva
      const axisLength = 120; // Linha estendida parecendo infinita na tela
      const axisPointsCount = 200;
      const axisPositions = new Float32Array(axisPointsCount * 3);

      for (let i = 0; i < axisPointsCount; i++) {
        const t = (i / (axisPointsCount - 1)) * 2.0 - 1.0; // -1.0 a 1.0
        axisPositions[i * 3] = 0;
        axisPositions[i * 3 + 1] = 0;
        axisPositions[i * 3 + 2] = t * (axisLength / 2);
      }

      const axisLineGeo = new THREE.BufferGeometry();
      axisLineGeo.setAttribute('position', new THREE.BufferAttribute(axisPositions, 3));

      const axisLineUniforms = {
        uTime: { value: 0.0 },
        uBuildProgress: { value: 0.0 }
      };

      const axisLineMat = new THREE.ShaderMaterial({
        uniforms: axisLineUniforms,
        transparent: true,
        depthWrite: false,
        vertexShader: `
          uniform float uTime;
          uniform float uBuildProgress;
          varying float vT;
          varying vec3 vWorldPos;
          
          void main() {
            // vT varia de -1.0 (extremidade 1) a +1.0 (extremidade 2), passando por 0.0 (centro)
            vT = position.z / 60.0;
            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uBuildProgress;
          varying float vT;
          varying vec3 vWorldPos;
          
          // Função de ruído suave (Noise estilo nuvens/fumaça flutuante)
          float hash(float n) { return fract(sin(n) * 43758.5453123); }
          float noise(float x) {
            float i = floor(x);
            float f = fract(x);
            float u = f * f * (3.0 - 2.0 * f);
            return mix(hash(i), hash(i + 1.0), u);
          }

          void main() {
            // Distância normalizada a partir do centro (0.0 no centro, 1.0 nas pontas)
            float distFromCenter = abs(vT);
            
            // Revelação convergente: As duas extremidades (1.0) começam a aparecer e avançam até o centro (0.0)
            float threshold = 1.0 - uBuildProgress;
            if (distFromCenter < threshold) {
              discard;
            }

            // Efeito holográfico de laser cyan na borda ativa de convergência das duas pontas
            float edgeDist = abs(distFromCenter - threshold);
            float buildGlow = smoothstep(0.08, 0.0, edgeDist);

            // Fade suave nas pontas externas estendidas (transição sutil)
            float edgeFade = smoothstep(1.0, 0.35, distFromCenter);
            
            // Durante a construção (uBuildProgress < 1.0), a linha é 100% visível (cloudAmount = 0.0)
            // Após completar (uBuildProgress = 1.0), as nuvens gradualmente entram em ação
            float cloudAmount = smoothstep(0.85, 1.0, uBuildProgress);
            
            float cloudNoise1 = noise(vT * 8.0 + uTime * 0.45);
            float cloudNoise2 = noise(vT * 16.0 - uTime * 0.25);
            float rawCloud = smoothstep(0.32, 0.72, cloudNoise1 * 0.6 + cloudNoise2 * 0.4);
            
            // Interpolar entre 1.0 (visibilidade total) e o ruído das nuvens
            float cloudMask = mix(1.0, rawCloud, cloudAmount);

            // Cor base do eixo: Grafite escuro sutil e elegante
            vec3 darkAxisColor = vec3(0.08, 0.10, 0.15);
            
            // Brilho verde neon apenas no laser da extremidade ativa que está construindo
            vec3 activeBuildGreenGlow = vec3(0.0, 1.0, 0.55);

            // Mistura: A linha é 100% escura em seu corpo, brilhando verde apenas na ponta em construção
            vec3 finalColor = mix(darkAxisColor, activeBuildGreenGlow, buildGlow * 1.5);
            
            // Opacidade discreta modulada pelo ruído de nuvens flutuantes (após a transição)
            float finalAlpha = edgeFade * cloudMask * (0.35 + buildGlow * 0.45);

            if (finalAlpha < 0.015) discard;

            gl_FragColor = vec4(finalColor, finalAlpha);
          }
        `
      });

      const axisLine = new THREE.Line(axisLineGeo, axisLineMat);
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

      // Executar Animações GSAP de Entrada (com construção holográfica e revelação de sombra)
      setupAnimations(camera, lights, controls, buildUniforms, shadowFloorMat);

      // Ocultar tela de carregamento
      ui.hideLoader();
    },
    (error) => {
      console.error('Falha ao inicializar o modelo:', error);
      ui.hideLoader();
    }
  );

  // 6. Redimensionamento de Tela Responsivo
  window.addEventListener('resize', () => {
    updateResponsiveCamera(camera, scene, floor, shadowFloorMat);

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });

  // 7. Loop de Renderização (Animation Loop)
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // Rotação ultrasutil no eixo Y guiada pelo movimento do mouse
    mouse.x += (mouse.targetX - mouse.x) * 0.015;

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

    // O modelo permanece 100% FIXO no mesmo ponto do espaço, apenas GIRANDO no seu próprio eixo
    if (modelState.mesh) {
      // Orientação sutil guiada pelo mouse no Y
      modelState.mesh.rotation.y = mouse.x * Math.PI * 0.036;

      // Rotação pura do disco no eixo Z em torno do próprio eixo central
      const rollAngle = pullState.xAngle * 1.5;
      modelState.mesh.rotation.z = -rollAngle;

      // Posição estritamente estática no centro do espaço (sem se mover pro lado)
      modelState.mesh.position.set(0, 0, 0);
    }

    // Atualizar o deslocamento no eixo X do anel central no shader
    if (coreUniformsRef) {
      coreUniformsRef.uCoreRotationX.value = pullState.xAngle;
    }

    // Atualizar tempo de animação da linha de eixo dinamica viva
    if (modelState.mesh) {
      modelState.mesh.traverse((child) => {
        if (child.userData && child.userData.uniforms && child.userData.uniforms.uTime) {
          child.userData.uniforms.uTime.value += delta;
        }
      });
    }

    // Atualizar partículas de faísca
    if (sparksEffect) {
      sparksEffect.update(delta);
    }

    // Atualizar projeções dos Callouts de Seções
    if (callouts) {
      callouts.update(delta);
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
