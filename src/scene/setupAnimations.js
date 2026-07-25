import gsap from 'gsap';

export function setupAnimations(camera, lights, controls, buildUniforms, shadowFloorMat) {
  // Salva a posição isométrica final de destino calculada (para desktop ou mobile)
  const targetPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };

  // Inicia a câmera de frente pro modelo 3D com visão um pouco de cima (0.0, 4.2, 9.5)
  camera.position.set(0.0, 4.2, 9.5);
  camera.lookAt(0, 0, 0);
  controls.target.set(0, 0, 0);

  const introTimeline = gsap.timeline();

  // Animação fluida da câmera girando e deslizando da frente para a perspectiva isométrica
  introTimeline.to(camera.position, {
    x: targetPos.x,
    y: targetPos.y,
    z: targetPos.z,
    duration: 2.6,
    ease: 'power3.inOut',
    onUpdate: () => {
      camera.lookAt(0, 0, 0);
      controls.update();
    }
  });

  // Animação de construção holográfica nativa
  if (buildUniforms && buildUniforms.clipPlane) {
    const maxY = buildUniforms.uMaxY.value;

    introTimeline.to(buildUniforms.clipPlane, {
      constant: maxY,
      duration: 2.4,
      ease: 'power2.inOut'
    }, 0);

    introTimeline.to(buildUniforms.uBuildProgress, {
      value: 1.0,
      duration: 2.4,
      ease: 'power2.inOut',
      onUpdate: () => {
        if (buildUniforms.axisLineUniforms) {
          buildUniforms.axisLineUniforms.uBuildProgress.value = buildUniforms.uBuildProgress.value;
        }
      }
    }, 0);
  }

  // Opacidade da sombra no chão
  if (shadowFloorMat) {
    shadowFloorMat.opacity = 0.32;
  }

  // Acendimento progressivo da luz azul interna (de 0 para 136)
  if (lights.blueInnerLight) {
    introTimeline.to(lights.blueInnerLight, {
      intensity: 136.0,
      duration: 1.8,
      ease: 'sine.inOut'
    }, "-=1.4");
  }

  return introTimeline;
}
