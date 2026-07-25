import gsap from 'gsap';

export function setupAnimations(camera, lights, controls, buildUniforms, shadowFloorMat) {
  // 1. Animação de Entrada com GSAP (Zoom 20% mais próximo)
  const startPos = { x: 10, y: 8.8, z: 10 };
  const targetPos = { x: 6.0, y: 5.2, z: 6.0 };

  camera.position.set(startPos.x, startPos.y, startPos.z);
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

  // Animação de construção holográfica nativa (corta malha e sombra simultaneamente)
  if (buildUniforms && buildUniforms.clipPlane) {
    buildUniforms.uBuildProgress.value = 0.0;
    
    // Posições inicial e final do plano de corte no espaço 3D
    const minY = buildUniforms.uMinY.value;
    const maxY = buildUniforms.uMaxY.value;

    // clipPlane equation: n·x + constant = 0 => para n=(0, -1, 0), y <= constant
    buildUniforms.clipPlane.constant = minY;

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
        // Sincronizar o progresso da linha do eixo com o progresso do holograma 3D
        if (buildUniforms.axisLineUniforms) {
          buildUniforms.axisLineUniforms.uBuildProgress.value = buildUniforms.uBuildProgress.value;
        }
      }
    }, 0);
  }

  // Garantir opacidade constante no chão para que a sombra seja impressa geometricamente de 0% a 100%
  if (shadowFloorMat) {
    shadowFloorMat.opacity = 0.32;
  }

  // Revelação da luz azul interna (acendimento constante sem pulsação/piscada)
  if (lights.blueInnerLight) {
    const baseIntensity = lights.blueInnerLight.intensity;
    lights.blueInnerLight.intensity = 0;
    
    introTimeline.to(lights.blueInnerLight, {
      intensity: baseIntensity,
      duration: 1.8,
      ease: 'sine.inOut'
    }, "-=1.4");
  }

  return introTimeline;
}
