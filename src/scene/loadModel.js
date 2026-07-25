import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export function loadModel(scene, onProgress, onLoad, onError) {
  const loader = new GLTFLoader();

  // Configurar DRACOLoader para descompactar o modelo GLB com Draco local
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('./draco/gltf/');
  loader.setDRACOLoader(dracoLoader);

  // Carregar Texturas da Engrenagem segundo as especificações técnicas
  const textureLoader = new THREE.TextureLoader();

  const baseColorMap = textureLoader.load('./obj3D/logo_basecolor.jpg');
  baseColorMap.flipY = false;
  baseColorMap.colorSpace = THREE.SRGBColorSpace;

  const normalMap = textureLoader.load('./obj3D/logo_normal.jpg');
  normalMap.flipY = false;

  const rmMap = textureLoader.load('./obj3D/logo_rm.jpg');
  rmMap.flipY = false;

  // Material PBR da Engrenagem com Reflexos de Estúdio Intensificados
  const gearMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#0d3b85'),
    map: baseColorMap,
    normalMap: normalMap,
    normalScale: new THREE.Vector2(2.0, 2.0),
    roughnessMap: rmMap,
    metalnessMap: rmMap,
    metalness: 1.0,
    roughness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.0,
    envMapIntensity: 2.8,
    side: THREE.DoubleSide,
    shadowSide: THREE.DoubleSide
  });

  loader.load(
    './obj3D/smlogo3d.glb',
    (gltf) => {
      const model = gltf.scene;

      // Calcular caixa delimitadora para centralizar e ajustar altura
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      // Normalizar escala se o modelo for muito grande ou pequeno
      const maxDim = Math.max(size.x, size.y, size.z);
      const targetScale = 3.5 / maxDim;
      model.scale.setScalar(targetScale);

      // Recalcular caixa com a nova escala
      box.setFromObject(model);
      box.getCenter(center);
      box.getSize(size);

      // Centralizar X, Y e Z no ponto exato (0, 0, 0)
      model.position.x = -center.x;
      model.position.y = -center.y;
      model.position.z = -center.z;

      // Criar grupo centralizador para rotações perfeitamente simétricas
      const pivotGroup = new THREE.Group();
      pivotGroup.add(model);

      // Calcular caixa delimitadora no espaço do mundo após todas as transformações de escala e posição
      const worldBox = new THREE.Box3().setFromObject(pivotGroup);

      // Plano de corte nativo do Three.js para recortar tanto a malha visual quanto as sombras no chão
      const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), worldBox.min.y - 0.2);

      // Parâmetros de construção holográfica vinculados ao plano de corte (com folga superior para término suave)
      const buildUniforms = {
        clipPlane: clipPlane,
        uBuildProgress: { value: 0.0 },
        uMinY: { value: worldBox.min.y - 0.2 },
        uMaxY: { value: worldBox.max.y + 0.5 }
      };

      // Uniform para o anel central girar/puxar no eixo X
      const innerCoreUniforms = {
        uCoreRotationX: { value: 0.0 }
      };

      // Injetar efeito de varredura neon ciano no gearMaterial
      gearMaterial.clippingPlanes = [clipPlane];
      gearMaterial.clipShadows = true;

      gearMaterial.onBeforeCompile = (shader) => {
        shader.uniforms.uBuildProgress = buildUniforms.uBuildProgress;
        shader.uniforms.uMinY = buildUniforms.uMinY;
        shader.uniforms.uMaxY = buildUniforms.uMaxY;
        shader.uniforms.uCoreRotationX = innerCoreUniforms.uCoreRotationX;

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
          
          // Efeito holográfico cibernético com grade de linhas na varredura
          if (uBuildProgress < 1.0) {
            float dist = buildHeight - vWorldPosition.y;
            if (dist > 0.0 && dist < 0.60) {
              float glow = smoothstep(0.60, 0.0, dist);
              vec3 cyanGlow = vec3(0.0, 0.75, 1.0);
              
              // Linhas horizontais (laser scanlines)
              float hLines = step(0.65, sin(vWorldPosition.y * 120.0));
              
              // Linhas verticais (ciber grid)
              float vLines = step(0.70, sin(vWorldPosition.x * 90.0) * sin(vWorldPosition.z * 90.0));
              
              float grid = max(hLines, vLines);
              
              // Anel de pulso neon na ponta exata da varredura
              float scanEdge = smoothstep(0.08, 0.0, dist);
              
              // Atenuação do brilho no finalzinho da animação (evita saltos)
              float endFade = smoothstep(1.0, 0.92, uBuildProgress);
              
              // Misturar cor de metal com a grade holográfica brilhante
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

      // Custom Depth Material para garantir que a sombra projetada no chão acompanhe nativamente o 3D
      const customDepthMaterial = new THREE.MeshDepthMaterial({
        depthPacking: THREE.RGBADepthPacking,
        clippingPlanes: [clipPlane],
        clipShadows: true
      });

      gearMaterial.customDepthMaterial = customDepthMaterial;

      // Aplicar material e habilitação de corte de sombra nativo em todas as malhas
      pivotGroup.traverse((child) => {
        if (child.isMesh) {
          child.material = gearMaterial;
          child.customDepthMaterial = customDepthMaterial;
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      scene.add(pivotGroup);

      if (onLoad) {
        onLoad(pivotGroup, { size, center: new THREE.Vector3(0, 0, 0) }, gearMaterial, buildUniforms, innerCoreUniforms);
      }
    },

    (xhr) => {
      if (xhr.lengthComputable && onProgress) {
        const percent = Math.round((xhr.loaded / xhr.total) * 100);
        onProgress(percent);
      }
    },
    (error) => {
      console.error('Erro ao carregar o modelo GLB:', error);
      if (onError) onError(error);
    }
  );
}
