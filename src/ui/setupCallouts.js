import * as THREE from 'three';
import gsap from 'gsap';

export function setupCallouts(scene, camera, renderer, modelState) {
  // 4 Tópicos do Menu — posições fixas em % da tela
  const calloutData = [
    { id: 'equipe',  label: 'NOSSA EQUIPE',       sublabel: 'Profissionais & Especialistas', side: 'left',  isTop: true  },
    { id: 'servicos',label: 'NOSSOS SERVIÇOS',     sublabel: 'Soluções Integradas 3D',        side: 'right', isTop: true  },
    { id: 'cases',   label: 'CASES DE CLIENTES',   sublabel: 'Projetos e Sucessos',           side: 'left',  isTop: false },
    { id: 'contato', label: 'FALE CONOSCO',        sublabel: 'Atendimento & Orçamentos',      side: 'right', isTop: false },
  ];

  // Função auxiliar para embalar o texto em letras individuais (spans)
  function createLetterSpans(text) {
    return text.split('').map(char => {
      if (char === ' ') {
        return '<span class="char space">&nbsp;</span>';
      }
      return `<span class="char">${char}</span>`;
    }).join('');
  }

  // Posições fixas dos cards em % da tela (10% da borda no mobile, 30%/70% no desktop)
  function getCardScreenPos(data) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const isMobile = w <= 768 || (w / h) < 1.0;

    // Posições verticais individuais calibradas
    let yFraction = data.isTop ? (isMobile ? 0.28 : 0.30) : (isMobile ? 0.72 : 0.70);

    if (data.id === 'servicos') {
      yFraction += (isMobile ? 0.05 : 0.04); // Desce um pouco NOSSOS SERVIÇOS
    } else if (data.id === 'cases') {
      yFraction -= (isMobile ? 0.05 : 0.04); // Sobe um pouco CASES DE CLIENTES
    }

    const x = isMobile
      ? (data.side === 'left' ? w * 0.10 : w * 0.90)
      : (data.side === 'left' ? w * 0.30 : w * 0.70);

    return { x, y: h * yFraction };
  }

  // 1. Injetar contêiner overlay dos cards HTML no DOM
  let calloutsContainer = document.getElementById('callouts-overlay');
  if (!calloutsContainer) {
    calloutsContainer = document.createElement('div');
    calloutsContainer.id = 'callouts-overlay';
    calloutsContainer.className = 'callouts-overlay';
    calloutsContainer.innerHTML = `<div class="callouts-nodes-layer" id="callouts-nodes-layer"></div>`;
    document.body.appendChild(calloutsContainer);
  }

  const nodesLayer = document.getElementById('callouts-nodes-layer');
  nodesLayer.innerHTML = '';

  // Criar os botões de Callout no DOM com estrutura de holograma e letras animadas
  const calloutElements = calloutData.map((data) => {
    const cardNode = document.createElement('div');
    cardNode.className = `callout-card callout-${data.side}`;
    cardNode.id = `callout-node-${data.id}`;

    const pos = getCardScreenPos(data);
    cardNode.style.left = `${pos.x}px`;
    cardNode.style.top  = `${pos.y}px`;

    const titleHTML = createLetterSpans(data.label);

    cardNode.innerHTML = `
      <div class="callout-content-box">
        <div class="holo-scan-line"></div>
        <h3 class="callout-title">${titleHTML}</h3>
      </div>
    `;

    cardNode.addEventListener('click', () => {
      console.log(`[Callout] Seção clicada: ${data.label}`);
      window.dispatchEvent(new CustomEvent('calloutClick', { detail: data }));
    });

    nodesLayer.appendChild(cardNode);
    return { data, element: cardNode };
  });

  // Atualizar posições CSS fixas e linhas 3D instantaneamente ao redimensionar a janela
  window.addEventListener('resize', () => {
    calloutElements.forEach(({ data, element }) => {
      const pos = getCardScreenPos(data);
      element.style.left = `${pos.x}px`;
      element.style.top  = `${pos.y}px`;
    });
    updatePositions(0);
  });

  // 2. Shader Material Holográfico para as Linhas 3D que ligam o centro aos cards
  const lineUniforms = {
    uBuildProgress: { value: 0.0 },
    uTime: { value: 0.0 }
  };

  const lineMaterial3D = new THREE.ShaderMaterial({
    uniforms: lineUniforms,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    vertexShader: `
      attribute float aProgress;
      varying float vProgress;
      varying vec3 vWorldPos;
      
      void main() {
        vProgress = aProgress;
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uBuildProgress;
      uniform float uTime;
      varying float vProgress;
      varying vec3 vWorldPos;

      float hash(float n) { return fract(sin(n) * 43758.5453123); }
      float noise(float x) {
        float i = floor(x);
        float f = fract(x);
        float u = f * f * (3.0 - 2.0 * f);
        return mix(hash(i), hash(i + 1.0), u);
      }

      void main() {
        // Linha se estende do centro (0.0) em direção aos cards (1.0) conforme o uBuildProgress
        if (vProgress > uBuildProgress) {
          discard;
        }

        // Quando a animação atinge 1.0 (linha 100% construída), o laser ciano desvanece totalmente (sem ponta brilhante sobrando)
        float buildEndFade = smoothstep(1.0, 0.94, uBuildProgress);

        // Laser/brilho neon ciano na borda de avanço da linha
        float edgeDist = abs(vProgress - uBuildProgress);
        float buildGlow = smoothstep(0.08, 0.0, edgeDist) * buildEndFade;

        // Suavização sutil perto do centro
        float edgeFade = smoothstep(0.0, 0.04, vProgress);

        // Cor do corpo da linha: Grafite tecnológico escuro
        vec3 darkColor = vec3(0.08, 0.10, 0.15);

        // Brilho laser ciano/neon vivo na ponta holográfica
        vec3 cyanLaserGlow = vec3(0.0, 0.90, 1.0);

        vec3 finalColor = mix(darkColor, cyanLaserGlow, buildGlow * 1.8);

        // Micro pulsação contínua holográfica sutil
        float pulse = noise(vProgress * 16.0 + uTime * 2.5) * 0.18 + 0.82;

        float finalAlpha = (0.65 + buildGlow * 0.35) * pulse * edgeFade;
        if (finalAlpha < 0.02) discard;

        gl_FragColor = vec4(finalColor, finalAlpha);
      }
    `
  });

  const lines3DGroup = new THREE.Group();
  lines3DGroup.name = 'CalloutLines3DGroup';

  const threeLines = calloutData.map(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(3 * 3); // 3 pontos: Origem → Dobra → Card
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Atributo customizado aProgress: 0.0 no centro, progressDobra na curva, 1.0 no card
    const progArray = new Float32Array([0.0, 0.5, 1.0]);
    geo.setAttribute('aProgress', new THREE.BufferAttribute(progArray, 1));

    const lineMesh = new THREE.Line(geo, lineMaterial3D);
    lines3DGroup.add(lineMesh);
    return { lineMesh, geo };
  });

  scene.add(lines3DGroup);

  // Vetores e utilitários de projeção plana paralela à câmera
  const centerWorld3D  = new THREE.Vector3();
  const cardWorld3D    = new THREE.Vector3();
  const elbowWorld3D   = new THREE.Vector3();
  const cameraDir      = new THREE.Vector3();
  const planeCam       = new THREE.Plane();
  const raycaster      = new THREE.Raycaster();
  const rayNDC         = new THREE.Vector2();

  function updatePositions(delta = 0.016) {
    if (!camera || !renderer) return;

    lineUniforms.uTime.value += delta;

    const width  = window.innerWidth;
    const height = window.innerHeight;

    // Obter o ponto pivô 3D exato do centro do eixo da engrenagem (centro geométrico exato 0, 0, 0)
    if (modelState && modelState.mesh) {
      modelState.mesh.localToWorld(centerWorld3D.set(0, 0, 0));
    } else {
      centerWorld3D.set(0, 0, 0);
    }

    // Projetar centro 3D → 2D na tela
    const centerProj    = centerWorld3D.clone().project(camera);
    const centerScreenX = (centerProj.x * 0.5 + 0.5) * width;
    const centerScreenY = (-centerProj.y * 0.5 + 0.5) * height;

    // Plano paralelo à câmera passando pelo centro 3D para projeção 2D->3D sem distorção de perspectiva
    camera.getWorldDirection(cameraDir);
    planeCam.setFromNormalAndCoplanarPoint(cameraDir.negate(), centerWorld3D);

    function getScreenWorldPos(screenX, screenY, targetVec3) {
      rayNDC.set((screenX / width) * 2 - 1, -(screenY / height) * 2 + 1);
      raycaster.setFromCamera(rayNDC, camera);
      raycaster.ray.intersectPlane(planeCam, targetVec3);
    }

    calloutElements.forEach(({ data, element }, index) => {
      const isMobile = width <= 768 || (width / height) < 1.0;
      const isLeft = data.side === 'left';
      const isTop  = data.isTop;
      
      let lineEndX, lineEndY, elbowScreenX, elbowScreenY;

      if (isMobile && element && element.offsetWidth > 0) {
        const rect = element.getBoundingClientRect();
        lineEndX = rect.left + rect.width / 2;

        if (isTop) {
          // Cards de cima no mobile: A linha vem de baixo e para 6px ANTES da borda inferior do card
          lineEndY = rect.bottom + 6;
        } else {
          // Cards de baixo no mobile: A linha vem de cima e chega a 6px ANTES da borda superior do card
          lineEndY = rect.top - 6;
        }

        // No mobile: posiciona o cotovelo 10% mais para a esquerda e um pouco mais para baixo
        const clearanceX = isLeft ? (data.id === 'equipe' ? -115 : -90) : 110;
        const yFactor = isTop ? 0.15 : 0.72;
        elbowScreenX = centerScreenX + clearanceX;
        elbowScreenY = centerScreenY + (lineEndY - centerScreenY) * yFactor;
      } else if (isMobile) {
        const pos = getCardScreenPos(data);
        lineEndX = isLeft ? pos.x + 35 : pos.x - 35;
        lineEndY = isTop ? pos.y + 14 : pos.y - 14;
        const clearanceX = isLeft ? (data.id === 'equipe' ? -115 : -90) : 110;
        const yFactor = isTop ? 0.15 : 0.72;
        elbowScreenX = centerScreenX + clearanceX;
        elbowScreenY = centerScreenY + (lineEndY - centerScreenY) * yFactor;
      } else {
        const pos = getCardScreenPos(data);
        lineEndX = pos.x;
        lineEndY = pos.y;
        elbowScreenX = centerScreenX + (isLeft ? -180 : 180);
        elbowScreenY = lineEndY;
      }

      // Converter pontos 2D de tela para coordenadas 3D no plano com 0.000px de erro de projeção
      getScreenWorldPos(elbowScreenX, elbowScreenY, elbowWorld3D);
      getScreenWorldPos(lineEndX, lineEndY, cardWorld3D);

      const d01 = centerWorld3D.distanceTo(elbowWorld3D);
      const d12 = elbowWorld3D.distanceTo(cardWorld3D);
      const totalDist = d01 + d12;
      const progressElbow = totalDist > 0 ? d01 / totalDist : 0.5;

      const { geo } = threeLines[index];
      const posAttr = geo.attributes.position;
      posAttr.setXYZ(0, centerWorld3D.x, centerWorld3D.y, centerWorld3D.z);
      posAttr.setXYZ(1, elbowWorld3D.x,  elbowWorld3D.y,  elbowWorld3D.z);
      posAttr.setXYZ(2, cardWorld3D.x,   cardWorld3D.y,   cardWorld3D.z);
      posAttr.needsUpdate = true;

      const progAttr = geo.attributes.aProgress;
      progAttr.setX(0, 0.0);
      progAttr.setX(1, progressElbow);
      progAttr.setX(2, 1.0);
      progAttr.needsUpdate = true;
    });
  }

  // Embaralhar array para revelação aleatória de caracteres (Fisher-Yates)
  function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Animação Holográfica de Entrada dos Cards e Linhas
  function animateIn() {
    // Timeline máster
    const tl = gsap.timeline({ delay: 1.0 });

    // 1. Preenchimento Holográfico por Varredura nas Linhas 3D
    tl.to(lineUniforms.uBuildProgress, {
      value: 1.0,
      duration: 1.8,
      ease: 'power2.inOut'
    }, 0);

    // 2. Animação Elegante de Preenchimento de Baixo para Cima dos Cards HTML
    calloutElements.forEach(({ element }, index) => {
      const contentBox   = element.querySelector('.callout-content-box');
      const scanLine     = element.querySelector('.holo-scan-line');
      const charElements = Array.from(element.querySelectorAll('.callout-title .char:not(.space)'));

      // Garantir visibilidade do card para o clip-path atuar
      element.style.opacity = '1';

      // Momento exato em que a linha 3D chega ao card específico
      const cardStartTime = 1.1 + index * 0.18;

      if (contentBox && scanLine) {
        const revealState = { progress: 0 }; // 0% (cortado) -> 100% (revelado)

        tl.to(scanLine, { opacity: 1, duration: 0.08 }, cardStartTime);

        // Preenchimento de Baixo para Cima (clip-path inset subindo de 100% a 0%)
        tl.to(revealState, {
          progress: 100,
          duration: 0.70,
          ease: 'power2.out',
          onUpdate: () => {
            const insetTop = 100 - revealState.progress;
            contentBox.style.clipPath = `inset(${insetTop}% 0 0 0)`;
            scanLine.style.top = `${insetTop}%`;
          }
        }, cardStartTime);

        // Desvanecer a linha laser ao terminar a subida
        tl.to(scanLine, {
          opacity: 0,
          duration: 0.25
        }, cardStartTime + 0.60);
      }

      // Fade In suave das letras do título durante a subida
      if (charElements.length > 0) {
        const shuffledChars = shuffleArray(charElements);
        
        tl.to(shuffledChars, {
          opacity: 1,
          y: 0,
          duration: 0.08,
          stagger: 0.03,
          ease: 'power1.out',
          onStart: function() {
            const targetChar = this.targets ? this.targets()[0] : null;
            if (targetChar) {
              targetChar.classList.add('holo-glow');
              setTimeout(() => targetChar.classList.remove('holo-glow'), 250);
            }
          }
        }, cardStartTime + 0.12);
      }
    });

    return tl;
  }

  return { 
    update: updatePositions, 
    animateIn,
    lineUniforms
  };
}

