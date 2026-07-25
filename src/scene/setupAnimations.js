import gsap from 'gsap';

export function setupAnimations(camera, lights, controls, buildUniforms, shadowFloorMat) {
  // 1. Animação de Entrada com GSAP (Zoom 20% mais próximo)
  const targetPos = { x: 6.0, y: 5.2, z: 6.0 };
  controls.target.set(0, 0, 0);

  const introTimeline = gsap.timeline();

  introTimeline.to(camera.position, {
    x: targetPos.x,
    y: targetPos.y,
    z: targetPos.z,
    duration: 2.5,
    ease: 'power3.out',
    onUpdate: () => controls.update()
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

  // Acendimento progressivo da luz azul interna (de 0 para 150)
  if (lights.blueInnerLight) {
    introTimeline.to(lights.blueInnerLight, {
      intensity: 150.0,
      duration: 1.8,
      ease: 'sine.inOut'
    }, "-=1.4");
  }

  return introTimeline;
}
