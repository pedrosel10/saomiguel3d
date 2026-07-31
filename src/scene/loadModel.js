import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { getKTX2Loader, loadTextureWithKTX2Fallback } from './setupKTX2.js';

export function loadModel(scene, onProgress, onLoad, onError, renderer) {
  const loader = new GLTFLoader();

  // Configurar DRACOLoader para descompactar o modelo GLB com Draco local
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('./draco/gltf/');
  loader.setDRACOLoader(dracoLoader);

  // Configurar KTX2Loader para descompactação de GPU nativa Basis se o renderer for fornecido
  if (renderer) {
    const ktx2Loader = getKTX2Loader(renderer);
    if (ktx2Loader) {
      loader.setKTX2Loader(ktx2Loader);
    }
  }

  // Texturas PBR da Engrenagem com suporte a KTX2 e fallback automático para JPG
  const baseColorMap = new THREE.Texture();
  baseColorMap.flipY = false;
  loadTextureWithKTX2Fallback('./obj3D/logo_basecolor.jpg', renderer, (tex) => {
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    gearMaterial.map = tex;
    gearMaterial.needsUpdate = true;
  });

  const normalMap = new THREE.Texture();
  normalMap.flipY = false;
  loadTextureWithKTX2Fallback('./obj3D/logo_normal.jpg', renderer, (tex) => {
    tex.flipY = false;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    gearMaterial.normalMap = tex;
    gearMaterial.needsUpdate = true;
  });

  const rmMap = new THREE.Texture();
  rmMap.flipY = false;
  loadTextureWithKTX2Fallback('./obj3D/logo_rm.jpg', renderer, (tex) => {
    tex.flipY = false;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    gearMaterial.roughnessMap = tex;
    gearMaterial.metalnessMap = tex;
    gearMaterial.needsUpdate = true;
  });

  // Material PBR da Engrenagem com Metal Escuro Profundo e Aspereza Micro-Texturizada
  const gearMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#051b42'), // Tom de azul marinho profundo e denso
    map: baseColorMap,
    normalMap: normalMap,
    normalScale: new THREE.Vector2(2.0, 2.0), // Mantém a ranhura mas sem estourar o brilho
    roughnessMap: rmMap,
    metalnessMap: rmMap,
    metalness: 0.98,
    roughness: 0.30, // Equilíbrio perfeito entre textura tátil e profundidade de cor
    clearcoat: 0.5,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.6, // Evita que a iluminação de estúdio esbanje/clareie o metal
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

      // Aplicar material, corte de sombra e camada exclusiva de iluminação
      pivotGroup.traverse((child) => {
        if (child.isMesh && child.geometry) {
          child.material = gearMaterial;
          child.customDepthMaterial = customDepthMaterial;
          child.castShadow = false;
          child.receiveShadow = false;
          child.layers.enable(1);
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
