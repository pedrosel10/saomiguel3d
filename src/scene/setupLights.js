import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

export function setupLights(scene, renderer) {
  // 1. HDRI Environment Map com PMREMGenerator
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  new RGBELoader().load('./obj3D/ferndale_studio_01_1k.hdr', (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    const envMap = pmrem.fromEquirectangular(texture).texture;
    scene.environment = envMap;
    texture.dispose();
    pmrem.dispose();
  });

  // 2. Ambient Light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
  scene.add(ambientLight);

  // 3. Hemisphere Light
  const hemiLight = new THREE.HemisphereLight(0xeff6ff, 0x475569, 0.6);
  scene.add(hemiLight);

  // 4. Key Light com projecao de sombra ativada para a engrenagem principal
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(4.0, 8.0, 6.0);
  keyLight.castShadow = true;
  const isMobileDevice = window.innerWidth <= 768 || ('ontouchstart' in window);
  const shadowSize = isMobileDevice ? 512 : 1024;
  keyLight.shadow.mapSize.set(shadowSize, shadowSize);
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.02;
  keyLight.shadow.radius = isMobileDevice ? 3.0 : 4.0;
  keyLight.shadow.camera.left = -6;
  keyLight.shadow.camera.right = 6;
  keyLight.shadow.camera.top = 6;
  keyLight.shadow.camera.bottom = -6;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 25;
  scene.add(keyLight);

  // 5. Front Fill Light
  const frontFillLight = new THREE.DirectionalLight(0xe0f2fe, 10.0);
  frontFillLight.position.set(-3.8, -1.0, 4.8);
  scene.add(frontFillLight);

  // 6. Top Highlight Light
  const topLight = new THREE.DirectionalLight(0xffffff, 0.1);
  topLight.position.set(-3.4, -2.4, 4.0);
  scene.add(topLight);

  // 7. Rim Light
  const rimLight = new THREE.DirectionalLight(0xbfdbfe, 0.7);
  rimLight.position.set(-13.2, -20.0, -17.0);
  scene.add(rimLight);

  // 8. Luz Azul Interna (Configuração personalizada pelo usuário)
  const blueInnerLight = new THREE.PointLight(0x0066ff, 136.0, 1.5, 2.0);
  blueInnerLight.position.set(-0.2, -0.1, -0.5);
  blueInnerLight.castShadow = false;
  scene.add(blueInnerLight);

  return {
    ambientLight,
    hemiLight,
    keyLight,
    dirLight: keyLight,
    frontFillLight,
    topLight,
    rimLight,
    blueInnerLight
  };
}
