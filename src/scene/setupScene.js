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
  const ISOMETRIC_POS = new THREE.Vector3(6.0, 5.2, 6.0);
  camera.position.copy(START_POS);
  camera.lookAt(0, 0, 0);
  camera.layers.enable(1); // Permite ver objetos do Layer 1 (Luz Azul exclusiva do 3D)

  // 4. Renderer com ACESFilmic, PCFShadowMap e SRGBColorSpace em alta qualidade nativa (mobile & desktop)
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  // DPR de alta definição para mobile aproveitando a leveza do novo modelo 3D
  const maxDPR = window.innerWidth <= 768 ? Math.min(window.devicePixelRatio, 2.5) : Math.min(window.devicePixelRatio, 2.0);
  renderer.setPixelRatio(maxDPR);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Sombras macias e de alta definição
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
    tex.repeat.set(150, 150); // Escala bem menor para os detalhes do projeto caberem harmoniosamente
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  });

  const planeGeo = new THREE.PlaneGeometry(600, 600); // Dimensão estendida para garantia de horizonte infinito
  const planeMat = new THREE.MeshStandardMaterial({
    map: floorTexture,
    bumpMap: noiseTexture, // Textura tátil sutil para o papel do estúdio não parecer plástico liso
    bumpScale: 0.08,        // Granulação sutil e elegante
    color: 0xffffff,       // Fundo branco limpo de estúdio
    roughness: 0.65,
    metalness: 0.0,
    envMapIntensity: 1.5,
    transparent: true,
    opacity: 0.88,         // Opacidade perfeita para a textura_projeto
  });

  const floor = new THREE.Mesh(planeGeo, planeMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.70; // Posicionado exatamente no contato da base da engrenagem 3D
  floor.receiveShadow = true;
  scene.add(floor);

  // Plano receptor de sombras de alta definição
  const shadowFloorMat = new THREE.ShadowMaterial({ opacity: 0.32 });
  const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), shadowFloorMat);
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.position.y = -1.69;
  shadowFloor.receiveShadow = true;
  scene.add(shadowFloor);

  // 6. Atualização responsiva da câmera, neblina e chão para mobile
  updateResponsiveCamera(camera, scene, floor, shadowFloor);

  return { scene, camera, renderer, floor, shadowFloor, shadowFloorMat, ISOMETRIC_POS, updateResponsiveCamera };
}

export function updateResponsiveCamera(camera, scene, floor, shadowFloor) {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;

  if (window.innerWidth <= 768 || aspect < 1.0) {
    // No mobile: ajusta o FOV para o modelo ficar ~30% mais próximo (ocupando 78% da largura da tela)
    const targetWidthFraction = 0.78;
    const modelWidth3D = 3.5;
    const targetDistance = 9.95188; // Distância do ISOMETRIC_POS ao centro

    const tanFOV = modelWidth3D / (2 * targetDistance * targetWidthFraction * aspect);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanFOV));

    // Centralização de precisão no mobile: compensa o ângulo isométrico para manter o elemento 3D 100% no centro da tela
    camera.position.set(5.65, 5.2, 6.35);
    camera.lookAt(0, 0, 0);

    // No mobile: chão ajustado na base exata do modelo 3D (sem flutuar)
    if (floor) {
      floor.position.y = -1.70;
      if (floor.material) {
        floor.material.opacity = 0.92;
        floor.material.color.setHex(0xffffff);
      }
    }
    if (shadowFloor) {
      shadowFloor.position.y = -1.69;
    }

    // Neblina suave calibrada no mobile para dissolver o chão infinitamente sem cortar a borda
    if (scene && scene.fog) {
      if (scene.fog.isFog) {
        scene.fog.near = 9.0;
        scene.fog.far = 28.0;
      } else {
        scene.fog.density = 0.038;
      }
    }
  } else {
    // No desktop: mantém o FOV padrão de 26°, posição isométrica original (6, 5.2, 6) e fundo branco
    camera.fov = 26;
    camera.position.set(6.0, 5.2, 6.0);
    camera.lookAt(0, 0, 0);

    if (floor) {
      floor.position.y = -1.70;
      if (floor.material) {
        floor.material.opacity = 0.85;
        floor.material.color.setHex(0xffffff);
      }
    }
    if (shadowFloor) {
      shadowFloor.position.y = -1.69;
    }
    if (scene && scene.fog) {
      if (scene.fog.isFog) {
        scene.fog.near = 11.0;
        scene.fog.far = 34.0;
      } else {
        scene.fog.density = 0.032;
      }
    }
  }

  camera.updateProjectionMatrix();
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
