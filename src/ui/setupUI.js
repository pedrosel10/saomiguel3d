import gsap from 'gsap';
import { GUI } from 'lil-gui';

export function setupUI({ camera, controls, lights, shadowFloorMat, modelState, defaultCameraPos }) {
  const loaderScreen = document.getElementById('loader-screen');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');

  // Atualizador de progresso da sequência Orbital
  const updateProgress = (percent) => {
    const orbit2 = document.getElementById('orbit-2');
    const orbit3 = document.getElementById('orbit-3');

    // Revelar órbita 2 (2 pontos) a partir de 30%
    if (orbit2 && percent >= 30) {
      orbit2.classList.add('active');
    }

    // Revelar órbita 3 (3 pontos) a partir de 65%
    if (orbit3 && percent >= 65) {
      orbit3.classList.add('active');
    }
  };

  // Esconder loader após carregar (desvanecer e revelar o site 3D)
  const hideLoader = () => {
    if (loaderScreen) {
      setTimeout(() => {
        loaderScreen.classList.add('hidden');
      }, 400);
    }
  };

  // (Preserva apenas funções essenciais do loader)

  // ==========================================
  // Painel de Controle de Iluminação Completo (lil-gui com Reset & Copiar)
  // ==========================================
  const gui = new GUI({ title: '⚙️ Controle de Cena & Iluminação' });
  gui.domElement.style.top = '24px';
  gui.domElement.style.right = '24px';
  gui.hide(); // Oculta a GUI por padrão

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

  return { updateProgress, hideLoader, gui, bindMaterialControls };
}
