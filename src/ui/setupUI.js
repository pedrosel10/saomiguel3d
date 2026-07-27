import gsap from 'gsap';
import { GUI } from 'lil-gui';

export function setupUI({ camera, controls, lights, shadowFloorMat, modelState, defaultCameraPos }) {
  const loaderScreen = document.getElementById('loader-screen');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');

  const startTime = performance.now();

  // Matriz da Silhueta do Prédio (7 colunas x 9 linhas = 39 blocos ativos)
  const BUILDING_MATRIX = [
    [0, 0, 0, 1, 0, 0, 0], // Topo / Spire Tip
    [0, 0, 0, 1, 0, 0, 0], // Haste Antena
    [0, 0, 1, 1, 1, 0, 0], // Coroa da Torre
    [0, 0, 1, 1, 1, 0, 0], // Torre Superior
    [0, 1, 1, 1, 1, 1, 0], // Corpo Médio
    [0, 1, 1, 1, 1, 1, 0], // Corpo Médio
    [1, 1, 1, 1, 1, 1, 1], // Base Principal
    [1, 1, 1, 1, 1, 1, 1], // Base Principal
    [1, 1, 1, 1, 1, 1, 1]  // Térreo
  ];

  const buildingGrid = document.getElementById('building-grid');
  const activeBlockElements = [];

  if (buildingGrid) {
    buildingGrid.innerHTML = '';
    
    const rows = BUILDING_MATRIX.length;
    const cols = BUILDING_MATRIX[0].length;
    const cellMap = {};

    // Criar elementos no grid DOM
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div');
        const isActive = BUILDING_MATRIX[r][c] === 1;
        cell.className = isActive ? 'building-cell cell--block' : 'building-cell cell--empty';
        buildingGrid.appendChild(cell);
        if (isActive) {
          cellMap[`${r}_${c}`] = cell;
        }
      }
    }

    // Lista ordenada de blocos da base para o topo (construção andar por andar)
    for (let r = rows - 1; r >= 0; r--) {
      for (let c = 0; c < cols; c++) {
        if (BUILDING_MATRIX[r][c] === 1) {
          activeBlockElements.push(cellMap[`${r}_${c}`]);
        }
      }
    }
  }

  const totalBlocks = activeBlockElements.length;

  // Atualizador de progresso da Matriz Minimalista do Prédio
  const updateProgress = (targetPercent) => {
    const clamped = Math.min(100, Math.max(0, targetPercent));
    const filledCount = Math.floor((clamped / 100) * totalBlocks);

    activeBlockElements.forEach((blockEl, idx) => {
      if (idx < filledCount) {
        blockEl.classList.add('is-filled');
      } else {
        blockEl.classList.remove('is-filled');
      }
    });
  };

  // Esconder loader após carregar e preencher todos os blocos do prédio
  const hideLoader = (onComplete) => {
    if (!loaderScreen) {
      if (onComplete) onComplete();
      return;
    }

    let progress = 0;
    const interval = setInterval(() => {
      progress += (100 - progress) * 0.12 + 1.2;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }
      updateProgress(progress);
    }, 35);

    const MIN_LOADER_DURATION = 2200; // ~2.2 segundos para exibição da construção
    const elapsed = performance.now() - startTime;
    const remainingTime = Math.max(0, MIN_LOADER_DURATION - elapsed);
    const startAnimTime = Math.max(0, remainingTime - 100);

    setTimeout(() => {
      if (onComplete) onComplete();
    }, startAnimTime);

    setTimeout(() => {
      updateProgress(100);
      loaderScreen.classList.add('hidden');
    }, remainingTime);
  };

  // (Preserva apenas funções essenciais do loader)

  // ==========================================
  // Painel de Controle de Iluminação Completo (lil-gui com Reset & Copiar)
  // ==========================================
  const gui = new GUI({ title: '⚙️ Controle de Cena & Iluminação' });
  gui.domElement.style.top = '24px';
  gui.domElement.style.right = '24px';
  gui.hide(); // Oculta a GUI por padrão no build de produção

  // Função utilitária para registrar controller com botão de reset individual
  const addControllerWithReset = (folder, object, property, min, max, step, name, defaultValue) => {
    const controller = folder.add(object, property, min, max, step).name(name);
    
    // Adicionar botão de reset (🔄) após a renderização do controller
    setTimeout(() => {
      if (controller.domElement) {
        const resetBtn = document.createElement('button');
        resetBtn.innerHTML = '↺';
        resetBtn.title = `Resetar ${name} para o valor inicial (${defaultValue})`;
        resetBtn.style.cssText = `
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          font-size: 14px;
          margin-left: 6px;
          padding: 0 4px;
          line-height: 1;
          transition: color 0.15s ease;
        `;
        resetBtn.onmouseover = () => resetBtn.style.color = '#0066ff';
        resetBtn.onmouseout = () => resetBtn.style.color = '#94a3b8';
        resetBtn.onclick = (e) => {
          e.stopPropagation();
          object[property] = defaultValue;
          controller.updateDisplay();
        };
        
        controller.domElement.style.display = 'flex';
        controller.domElement.style.alignItems = 'center';
        controller.domElement.appendChild(resetBtn);
      }
    }, 10);

    return controller;
  };

  // Botão Global: Copiar Configurações de Iluminação & Sombra
  const configActions = {
    copyConfig: () => {
      const keyShadow = lights.keyLight?.shadow;
      const configData = {
        keyLight: lights.keyLight ? {
          intensity: lights.keyLight.intensity,
          position: { x: lights.keyLight.position.x, y: lights.keyLight.position.y, z: lights.keyLight.position.z }
        } : null,
        frontFillLight: lights.frontFillLight ? {
          intensity: lights.frontFillLight.intensity,
          position: { x: lights.frontFillLight.position.x, y: lights.frontFillLight.position.y, z: lights.frontFillLight.position.z }
        } : null,
        topLight: lights.topLight ? {
          intensity: lights.topLight.intensity,
          position: { x: lights.topLight.position.x, y: lights.topLight.position.y, z: lights.topLight.position.z }
        } : null,
        rimLight: lights.rimLight ? {
          intensity: lights.rimLight.intensity,
          position: { x: lights.rimLight.position.x, y: lights.rimLight.position.y, z: lights.rimLight.position.z }
        } : null,
        blueInnerLight: lights.blueInnerLight ? {
          intensity: lights.blueInnerLight.intensity,
          position: { x: lights.blueInnerLight.position.x, y: lights.blueInnerLight.position.y, z: lights.blueInnerLight.position.z }
        } : null,
        shadowConfig: {
          opacity: shadowFloorMat ? shadowFloorMat.opacity : 0.45,
          radius: keyShadow ? keyShadow.radius : 2.5,
          bias: keyShadow ? keyShadow.bias : -0.0005,
          normalBias: keyShadow ? keyShadow.normalBias : 0.02
        },
        ambientLight: lights.ambientLight ? { intensity: lights.ambientLight.intensity } : null,
        hemiLight: lights.hemiLight ? { intensity: lights.hemiLight.intensity } : null
      };

      const formattedText = `### Configurações da Engrenagem 3D

\`\`\`json
${JSON.stringify(configData, null, 2)}
\`\`\``;

      navigator.clipboard.writeText(formattedText).then(() => {
        alert('📋 Configurações de iluminação e sombras copiadas!');
      }).catch(err => {
        console.error('Erro ao copiar:', err);
        prompt('Copie as configurações abaixo:', formattedText);
      });
    }
  };

  gui.add(configActions, 'copyConfig').name('📋 Copiar Configurações');

  // 0. Pasta de Sombras do Chão (Shadow Floor)
  if (shadowFloorMat || lights.keyLight?.shadow) {
    const fShadow = gui.addFolder('🌑 Sombras do Chão');
    if (shadowFloorMat) {
      addControllerWithReset(fShadow, shadowFloorMat, 'opacity', 0, 1, 0.02, 'Opacidade da Sombra', shadowFloorMat.opacity);
    }
    if (lights.keyLight?.shadow) {
      const shadow = lights.keyLight.shadow;
      addControllerWithReset(fShadow, shadow, 'radius', 0, 10, 0.2, 'Suavidade (Radius)', shadow.radius);
      addControllerWithReset(fShadow, shadow, 'bias', -0.01, 0.01, 0.0001, 'Shadow Bias', shadow.bias);
      addControllerWithReset(fShadow, shadow, 'normalBias', 0, 0.2, 0.005, 'Normal Bias', shadow.normalBias);
    }
    fShadow.open();
  }

  // 1. Key Light (Luz Principal)
  if (lights.keyLight) {
    const kPos = lights.keyLight.position;
    const fKey = gui.addFolder('💡 Key Light (Principal)');
    addControllerWithReset(fKey, lights.keyLight, 'intensity', 0, 10, 0.1, 'Intensidade', lights.keyLight.intensity);
    addControllerWithReset(fKey, kPos, 'x', -20, 20, 0.2, 'Posição X', kPos.x);
    addControllerWithReset(fKey, kPos, 'y', -20, 20, 0.2, 'Posição Y', kPos.y);
    addControllerWithReset(fKey, kPos, 'z', -20, 20, 0.2, 'Posição Z', kPos.z);
    fKey.close();
  }

  // 2. Front Fill Light (Preenchimento Frontal)
  if (lights.frontFillLight) {
    const fPos = lights.frontFillLight.position;
    const fFill = gui.addFolder('🔆 Front Fill (Preenchimento)');
    addControllerWithReset(fFill, lights.frontFillLight, 'intensity', 0, 10, 0.1, 'Intensidade', lights.frontFillLight.intensity);
    addControllerWithReset(fFill, fPos, 'x', -20, 20, 0.2, 'Posição X', fPos.x);
    addControllerWithReset(fFill, fPos, 'y', -20, 20, 0.2, 'Posição Y', fPos.y);
    addControllerWithReset(fFill, fPos, 'z', -20, 20, 0.2, 'Posição Z', fPos.z);
    fFill.close();
  }

  // 3. Top Light (Luz Superior / Bisotes)
  if (lights.topLight) {
    const tPos = lights.topLight.position;
    const fTop = gui.addFolder('✨ Top Light (Superior)');
    addControllerWithReset(fTop, lights.topLight, 'intensity', 0, 10, 0.1, 'Intensidade', lights.topLight.intensity);
    addControllerWithReset(fTop, tPos, 'x', -20, 20, 0.2, 'Posição X', tPos.x);
    addControllerWithReset(fTop, tPos, 'y', -20, 20, 0.2, 'Posição Y', tPos.y);
    addControllerWithReset(fTop, tPos, 'z', -20, 20, 0.2, 'Posição Z', tPos.z);
    fTop.close();
  }

  // 4. Rim Light (Contorno Traseiro)
  if (lights.rimLight) {
    const rPos = lights.rimLight.position;
    const fRim = gui.addFolder('📐 Rim Light (Contorno)');
    addControllerWithReset(fRim, lights.rimLight, 'intensity', 0, 10, 0.1, 'Intensidade', lights.rimLight.intensity);
    addControllerWithReset(fRim, rPos, 'x', -20, 20, 0.2, 'Posição X', rPos.x);
    addControllerWithReset(fRim, rPos, 'y', -20, 20, 0.2, 'Posição Y', rPos.y);
    addControllerWithReset(fRim, rPos, 'z', -20, 20, 0.2, 'Posição Z', rPos.z);
    fRim.close();
  }

  // 5. Blue Inner Light (Luz Azul Interna)
  if (lights.blueInnerLight) {
    const bPos = lights.blueInnerLight.position;
    const fBlue = gui.addFolder('🔷 Luz Azul Interna');
    addControllerWithReset(fBlue, lights.blueInnerLight, 'intensity', 0, 150, 1, 'Intensidade', lights.blueInnerLight.intensity);
    addControllerWithReset(fBlue, bPos, 'x', -5, 5, 0.1, 'Posição X', bPos.x);
    addControllerWithReset(fBlue, bPos, 'y', -5, 5, 0.1, 'Posição Y', bPos.y);
    addControllerWithReset(fBlue, bPos, 'z', -5, 5, 0.1, 'Posição Z', bPos.z);
    fBlue.open();
  }

  // 6. Ambient & Hemisphere Light
  const fAmb = gui.addFolder('🌍 Luz Ambiente Global');
  if (lights.ambientLight) {
    addControllerWithReset(fAmb, lights.ambientLight, 'intensity', 0, 3, 0.05, 'Ambiente', lights.ambientLight.intensity);
  }
  if (lights.hemiLight) {
    addControllerWithReset(fAmb, lights.hemiLight, 'intensity', 0, 3, 0.05, 'Hemisfério', lights.hemiLight.intensity);
  }
  fAmb.close();

  // Função para vincular controles do Material da Engrenagem quando carregado
  const bindMaterialControls = (gearMaterial) => {
    if (!gearMaterial) return;

    const fMat = gui.addFolder('🎨 Material da Engrenagem (PBR)');
    
    // Cor Base (Color Picker)
    const colorProxy = { color: '#' + gearMaterial.color.getHexString() };
    fMat.addColor(colorProxy, 'color').name('Cor Base').onChange((val) => {
      gearMaterial.color.set(val);
    });

    addControllerWithReset(fMat, gearMaterial, 'metalness', 0, 1, 0.01, 'Metalness (Metálico)', gearMaterial.metalness);
    addControllerWithReset(fMat, gearMaterial, 'roughness', 0, 1, 0.01, 'Roughness (Rugosidade)', gearMaterial.roughness);
    addControllerWithReset(fMat, gearMaterial, 'clearcoat', 0, 1, 0.01, 'Clearcoat (Verniz)', gearMaterial.clearcoat);
    addControllerWithReset(fMat, gearMaterial, 'clearcoatRoughness', 0, 1, 0.01, 'Clearcoat Roughness', gearMaterial.clearcoatRoughness);
    addControllerWithReset(fMat, gearMaterial, 'envMapIntensity', 0, 10, 0.1, 'Reflexo HDRI (EnvMap)', gearMaterial.envMapIntensity);
    
    if (gearMaterial.normalScale) {
      const normalProxy = { scale: gearMaterial.normalScale.x };
      addControllerWithReset(fMat, normalProxy, 'scale', 0, 5, 0.1, 'Normal Scale (Relevo)', gearMaterial.normalScale.x).onChange((val) => {
        gearMaterial.normalScale.set(val, val);
      });
    }

    fMat.open();
  };

  // ==========================================
  // Widget de Nível Minimalista (Canto Inferior Esquerdo - Mobile)
  // ==========================================
  let levelHud = document.getElementById('mobile-level-hud');
  let levelHandle = null;
  let levelTrack = null;

  if (!levelHud) {
    levelHud = document.createElement('div');
    levelHud.id = 'mobile-level-hud';
    levelHud.className = 'mobile-level-hud';
    levelHud.innerHTML = `
      <div class="level-track-wrapper" id="level-track-wrapper">
        <div class="level-track-bar">
          <div class="level-center-mark"></div>
          <div class="level-bubble-handle" id="level-bubble-handle"></div>
        </div>
      </div>
    `;
    document.body.appendChild(levelHud);
  }

  levelHandle = document.getElementById('level-bubble-handle');
  levelTrack = document.getElementById('level-track-wrapper');

  let isDraggingLevel = false;

  // Função para atualizar a posição da bolha sincronizada com a INCLINAÇÃO 3D (mouse.x)
  const updateLevelGauge = (tiltNormalized) => {
    if (!levelHandle || isDraggingLevel) return;
    // Normalized [-1.0, 1.0] -> [0%, 100%]
    const normalized = Math.max(-1.0, Math.min(1.0, tiltNormalized));
    const percent = 50 + normalized * 50;
    levelHandle.style.left = `${percent}%`;
  };

  // Interatividade: Deslizar a bolha do nível altera o ângulo do 3D em tempo real
  if (levelTrack) {
    const handlePointerMove = (clientX) => {
      const rect = levelTrack.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const rawFraction = clickX / rect.width; // 0.0 a 1.0
      const normalizedTarget = Math.max(-1.0, Math.min(1.0, (rawFraction - 0.5) * 2));

      if (levelHandle) {
        const percent = 50 + normalizedTarget * 50;
        levelHandle.style.left = `${percent}%`;
      }

      // Notificar o main.js para mover o 3D
      window.dispatchEvent(new CustomEvent('levelGaugeDrag', { detail: { normalizedTarget } }));
    };

    levelTrack.addEventListener('pointerdown', (e) => {
      isDraggingLevel = true;
      try {
        levelTrack.setPointerCapture(e.pointerId);
      } catch (_) {}
      handlePointerMove(e.clientX);
    });

    levelTrack.addEventListener('pointermove', (e) => {
      if (isDraggingLevel) {
        handlePointerMove(e.clientX);
      }
    });

    const stopDrag = (e) => {
      if (isDraggingLevel) {
        isDraggingLevel = false;
        try {
          levelTrack.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }
    };

    levelTrack.addEventListener('pointerup', stopDrag);
    levelTrack.addEventListener('pointercancel', stopDrag);
  }

  return { updateProgress, hideLoader, gui, bindMaterialControls, updateLevelGauge };
}
