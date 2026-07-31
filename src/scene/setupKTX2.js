/**
 * setupKTX2.js
 * Módulo de suporte ao KTX2Loader com Basis Universal no Three.js.
 * Habilita transcodificação de GPU nativa (ASTC/ETC2/BC7) com suporte ao GLTFLoader e fallback automático.
 */
import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

let ktx2LoaderInstance = null;

export function getKTX2Loader(renderer) {
  if (!ktx2LoaderInstance && renderer) {
    ktx2LoaderInstance = new KTX2Loader()
      .setTranscoderPath('./basis/')
      .detectSupport(renderer);
  }
  return ktx2LoaderInstance;
}

/**
 * Tenta carregar a textura .ktx2 equivalente ou faz fallback automático para .webp / .jpg.
 */
export function loadTextureWithKTX2Fallback(url, renderer, onLoad, onError) {
  const ktx2Url = url.replace(/\.(webp|jpg|png|jpeg)$/i, '.ktx2');
  const loader = getKTX2Loader(renderer);

  if (loader) {
    loader.load(
      ktx2Url,
      (texture) => {
        if (typeof onLoad === 'function') onLoad(texture);
      },
      undefined,
      () => {
        // Fallback automático para a imagem original caso o arquivo .ktx2 não esteja presente
        const standardLoader = new THREE.TextureLoader();
        standardLoader.load(url, onLoad, undefined, onError);
      }
    );
  } else {
    const standardLoader = new THREE.TextureLoader();
    standardLoader.load(url, onLoad, undefined, onError);
  }
}
