import * as THREE from 'three';

export function setupSparks(scene, buildUniforms) {
  const particleCount = 180;
  const geometry = new THREE.BufferGeometry();
  
  const positions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  const lifetimes = new Float32Array(particleCount);
  const maxLifetimes = new Float32Array(particleCount);

  // Criar textura de faísca circular incandescente com brilho suave
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.25, 'rgba(255, 180, 50, 0.9)');
  gradient.addColorStop(0.6, 'rgba(255, 80, 0, 0.6)');
  gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(32, 32, 32, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);

  const material = new THREE.PointsMaterial({
    size: 0.22,
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    color: new THREE.Color(0xffbb44)
  });

  // Inicializar estado das faíscas
  for (let i = 0; i < particleCount; i++) {
    lifetimes[i] = 0;
    maxLifetimes[i] = 0.3 + Math.random() * 0.5;
    sizes[i] = 0.08 + Math.random() * 0.15;
    
    // Iniciar fora da visão até a ativação
    positions[i * 3] = 0;
    positions[i * 3 + 1] = -999;
    positions[i * 3 + 2] = 0;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const particleSystem = new THREE.Points(geometry, material);
  scene.add(particleSystem);

  // Função de emissão de uma nova faísca na linha de corte atual
  function spawnSpark(index, currentY) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 1.0 + Math.random() * 1.2;

    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = currentY + (Math.random() - 0.5) * 0.08;
    positions[index * 3 + 2] = Math.sin(angle) * radius;

    // Velocidade de explosão de solda (tangencial e saltando para fora)
    const speed = 1.5 + Math.random() * 3.0;
    const upSpeed = 1.0 + Math.random() * 3.5;

    velocities[index * 3] = (Math.cos(angle) + (Math.random() - 0.5) * 0.8) * speed;
    velocities[index * 3 + 1] = upSpeed;
    velocities[index * 3 + 2] = (Math.sin(angle) + (Math.random() - 0.5) * 0.8) * speed;

    lifetimes[index] = maxLifetimes[index];
  }

  // Atualizador a cada frame de animação
  function update(delta) {
    if (!buildUniforms || !buildUniforms.uBuildProgress) return;
    
    const progress = buildUniforms.uBuildProgress.value;
    const isBuilding = progress > 0.01 && progress < 0.99;
    
    const minY = buildUniforms.uMinY ? buildUniforms.uMinY.value : -1.75;
    const maxY = buildUniforms.uMaxY ? buildUniforms.uMaxY.value : 1.75;
    const currentY = THREE.MathUtils.lerp(minY, maxY, progress);

    const posAttr = geometry.attributes.position;

    for (let i = 0; i < particleCount; i++) {
      if (lifetimes[i] > 0) {
        lifetimes[i] -= delta;

        // Movimento com gravidade e desaceleração
        positions[i * 3] += velocities[i * 3] * delta;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * delta;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * delta;

        // Gravidade puxando as faíscas incandescentes para o chão
        velocities[i * 3 + 1] -= 9.8 * delta;
      } else if (isBuilding) {
        // Renascer faísca na borda ativa da solda
        if (Math.random() < 0.4) {
          spawnSpark(i, currentY);
        } else {
          positions[i * 3 + 1] = -999;
        }
      } else {
        positions[i * 3 + 1] = -999;
      }
    }

    posAttr.needsUpdate = true;
  }

  return { update };
}
