import * as THREE from 'three';

export function setupScene(canvas) {
  // 1. Cena com fundo limpo (sem chão/grid)
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xfcfcfd);

  // 2. Neblina sutil para profundidade de campo limpa
  scene.fog = new THREE.FogExp2(0xfcfcfd, 0.015);

  // 3. Câmera Isométrica focada perfeitamente no centro (0, 0, 0)
  const aspect = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(26, aspect, 0.1, 200);

  // Posição inicial distante da câmera antes da animação de entrada
  const START_POS = new THREE.Vector3(10.0, 8.8, 10.0);
  const ISOMETRIC_POS = new THREE.Vector3(6.0, 5.2, 6.0);
  camera.position.copy(START_POS);
  camera.lookAt(0, 0, 0);

  // 4. Renderer com ACESFilmic, PCFShadowMap e SRGBColorSpace conforme especificações
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  const maxDPR = window.innerWidth <= 768 ? 1.5 : 2.0;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDPR));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;

  // 5. Chão com a textura_projeto.webp e transição para neblina branca
  const textureLoader = new THREE.TextureLoader();
  const floorTexture = textureLoader.load('./textura_projeto.webp', (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 8); // Tiles menores — escala mais próxima do tamanho original da imagem
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  });

  const planeGeo = new THREE.PlaneGeometry(120, 120);
  const planeMat = new THREE.MeshStandardMaterial({
    map: floorTexture,
    color: 0x888888,       // Cinza escuro para alto contraste
    roughness: 0.65,
    metalness: 0.0,
    envMapIntensity: 1.5,
    transparent: true,
    opacity: 0.82,         // Opacidade alta mantendo o fundo visível levemente
  });

  const floor = new THREE.Mesh(planeGeo, planeMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.75; // Posicionado na base da engrenagem 3D
  floor.receiveShadow = true;
  scene.add(floor);

  // Plano receptor de sombras de alta definição
  const shadowFloorMat = new THREE.ShadowMaterial({ opacity: 0.32 });
  const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), shadowFloorMat);
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.position.y = -1.74;
  shadowFloor.receiveShadow = true;
  scene.add(shadowFloor);

  // 6. Atualização responsiva da câmera, neblina e chão para mobile
  updateResponsiveCamera(camera, scene, floor, shadowFloorMat);

  return { scene, camera, renderer, floor, shadowFloorMat, ISOMETRIC_POS, updateResponsiveCamera };
}

export function updateResponsiveCamera(camera, scene, floor, shadowFloorMat) {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;

  if (window.innerWidth <= 768 || aspect < 1.0) {
    // No mobile: ajusta o FOV para o modelo ficar ~30% mais próximo (ocupando 78% da largura da tela)
    const targetWidthFraction = 0.78;
    const modelWidth3D = 3.5;
    const targetDistance = 9.95188; // Distância do ISOMETRIC_POS ao centro

    const tanFOV = modelWidth3D / (2 * targetDistance * targetWidthFraction * aspect);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanFOV));

    // No mobile: move o chão com textura_projeto mais para baixo (-2.45) e deixa a textura mais opaca e visível
    if (floor) {
      floor.position.y = -2.45;
      if (floor.material) {
        floor.material.opacity = 0.96;
        floor.material.color.setHex(0xaaaaaa);
      }
    }

    // Neblina suave calibrada no mobile para não apagar a textura
    if (scene && scene.fog) {
      scene.fog.density = 0.022;
    }
  } else {
    // No desktop: mantém o FOV padrão de 26°, posição e neblina sutil
    camera.fov = 26;
    if (floor) {
      floor.position.y = -1.75;
      if (floor.material) {
        floor.material.opacity = 0.82;
        floor.material.color.setHex(0x888888);
      }
    }
    if (scene && scene.fog) {
      scene.fog.density = 0.015;
    }
  }

  camera.updateProjectionMatrix();
}
