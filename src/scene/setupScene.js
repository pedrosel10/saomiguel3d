import * as THREE from 'three';

export function setupScene(canvas) {
  // 1. Cena com fundo limpo (sem chão/grid)
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xfcfcfd);

  // 2. Neblina sutil para efeito de chão infinito dissolvendo no fundo
  scene.fog = new THREE.Fog(0xfcfcfd, 11.0, 34.0);

  // 3. Câmera Isométrica focada perfeitamente no centro (0, 0, 0)
  const aspect = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(26, aspect, 0.1, 200);

  // Posição inicial da câmera: de frente pro modelo 3D com visão vista de cima (0.0, 4.2, 9.5)
  const START_POS = new THREE.Vector3(0.0, 4.2, 9.5);
  const ISOMETRIC_POS = new THREE.Vector3(5.4, 4.68, 5.4);
  camera.position.copy(START_POS);
  camera.lookAt(0, 0, 0);
  camera.layers.enable(1); // Permite ver objetos do Layer 1 (Luz Azul exclusiva do 3D)

  const isMobileDevice = window.innerWidth <= 768 || ('ontouchstart' in window);

  // 4. Renderer com ACESFilmic e SRGBColorSpace otimizado para Mobile & Desktop
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
    precision: 'highp'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  const maxDPR = isMobileDevice ? Math.min(window.devicePixelRatio, 1.8) : Math.min(window.devicePixelRatio, 3.0);
  renderer.setPixelRatio(maxDPR);
  renderer.shadowMap.enabled = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;

  // 5. Chão com a textura_projeto.webp (em escala reduzida) e textura tátil de micro-granulação
  const noiseTexture = createNoiseBumpTexture();

  const textureLoader = new THREE.TextureLoader();
  const floorTexture = textureLoader.load('./textura_projeto.webp', (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(36, 36); // Escala perfeita para os detalhes dos desenhos do projeto
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  });

  const planeGeo = new THREE.PlaneGeometry(600, 600); // Dimensão estendida para garantia de horizonte infinito
  const planeMat = new THREE.MeshStandardMaterial({
    map: floorTexture,
    bumpMap: noiseTexture, // Textura tátil sutil para o papel do estúdio não parecer plástico liso
    bumpScale: 0.05,        // Granulação sutil
    color: 0xffffff,       // Fundo branco limpo de estúdio
    roughness: 0.50,
    metalness: 0.0,
    envMapIntensity: 1.2,
    transparent: true,
    opacity: 1.0,          // 100% de opacidade para contraste e evidência total do projeto no chão
  });

  const floor = new THREE.Mesh(planeGeo, planeMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.88; // Posicionado com folga limpa abaixo da base da engrenagem 3D
  scene.add(floor);

  // 6. Atualização responsiva da câmera, neblina e chão para mobile
  updateResponsiveCamera(camera, scene, floor, null);

  return { scene, camera, renderer, floor, shadowFloor: null, shadowFloorMat: null, ISOMETRIC_POS, updateResponsiveCamera };
}

export function updateResponsiveCamera(camera, scene, floor, shadowFloor) {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;

  if (window.innerWidth <= 768 || aspect < 1.0) {
    // No mobile: ajusta o FOV para o modelo ficar ~10% mais próximo (ocupando 86% da largura da tela)
    const targetWidthFraction = 0.86;
    const modelWidth3D = 3.5;
    const targetDistance = 9.95188; // Distância do ISOMETRIC_POS ao centro

    const tanFOV = modelWidth3D / (2 * targetDistance * targetWidthFraction * aspect);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanFOV));

    // Câmera no mobile: ajusta o enquadramento 2D para centralizar o 3D com margens iguais na esquerda e direita
    camera.position.set(3.85, 4.68, 7.35);
    camera.lookAt(0, 0, 0);

    // No mobile: chão ajustado na base exata do modelo 3D (sem flutuar)
    if (floor) {
      floor.position.y = -1.88;
      if (floor.material) {
        floor.material.opacity = 1.0;
        floor.material.color.setHex(0xffffff);
      }
    }
    if (shadowFloor) {
      shadowFloor.position.y = -1.87;
    }

    // Neblina empurrada para o fundo para manter os desenhos do chão 100% nítidos
    if (scene && scene.fog) {
      if (scene.fog.isFog) {
        scene.fog.near = 18.0;
        scene.fog.far = 50.0;
      } else {
        scene.fog.density = 0.015;
      }
    }
  } else {
    // No desktop: mantém o FOV de 26° e posição isométrica
    camera.fov = 26;
    camera.position.set(5.4, 4.68, 5.4);
    camera.lookAt(0, 0, 0);

    if (floor) {
      floor.position.y = -1.88;
      if (floor.material) {
        floor.material.opacity = 1.0;
        floor.material.color.setHex(0xffffff);
      }
    }
    if (shadowFloor) {
      shadowFloor.position.y = -1.87;
    }
    if (scene && scene.fog) {
      if (scene.fog.isFog) {
        scene.fog.near = 15.0;
        scene.fog.far = 45.0;
      } else {
        scene.fog.density = 0.022;
      }
    }
  }

  camera.updateProjectionMatrix();

  if (!camera.userData) camera.userData = {};
  camera.userData.basePosition = camera.position.clone();
}

function createNoiseBumpTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(256, 256);
  const data = imgData.data;

  // Gerar ruído de micro-granulação tátil (textura de papel técnico / concreto fino)
  for (let i = 0; i < data.length; i += 4) {
    const val = 128 + (Math.random() - 0.5) * 55;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
    data[i + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  return texture;
}

function createFakeShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Gradiente radial ultra-suave para simular a sombra estática de contato (fake blob shadow)
  const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  gradient.addColorStop(0.25, 'rgba(0, 0, 0, 0.35)');
  gradient.addColorStop(0.55, 'rgba(0, 0, 0, 0.12)');
  gradient.addColorStop(0.85, 'rgba(0, 0, 0, 0.03)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}
