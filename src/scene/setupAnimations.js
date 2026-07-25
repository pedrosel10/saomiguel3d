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

  // Executar a Animação do Gancho de Guindaste trazendo o H1 de cima
  animateCraneHook();

  return introTimeline;
}

export function animateCraneHook() {
  const hook = document.getElementById('crane-hook');
  const title = document.getElementById('brand-title');
  if (!hook || !title) return;

  // Garante a posição inicial lá no alto fora da tela (-120vh)
  gsap.set(hook, { y: '-120vh', opacity: 1, display: 'block' });
  gsap.set(title, { y: '-120vh', opacity: 1 });

  const hookTl = gsap.timeline({ delay: 0.15 });

  // 1. O Gancho desce de cima trazendo o texto "Engenharia e construção." enganchado
  hookTl.to([hook, title], {
    y: 0,
    duration: 1.6,
    ease: 'power3.out'
  });

  // 2. Leve assentamento elástico ao desenganchar o texto no lugar exato
  hookTl.to(title, {
    y: 4,
    duration: 0.14,
    yoyo: true,
    repeat: 1,
    ease: 'sine.inOut'
  });

  // 3. O Gancho solta o texto no lugar e sobe de volta para o topo da tela
  hookTl.to(hook, {
    y: '-120vh',
    duration: 1.4,
    ease: 'power2.in',
    onComplete: () => {
      hook.style.display = 'none'; // Oculta o gancho após subir e sair da tela
    }
  }, "+=0.12");

  return hookTl;
}
