/**
 * adaptiveDPR.js
 * Sistema de DPR (Device Pixel Ratio) Adaptativo para Three.js.
 * 
 * Regras:
 * - Iniciar sempre em DPR = 1.5.
 * - Avaliar FPS médio em janela móvel de 2.5s.
 * - Regras de Níveis:
 *   - FPS >= 58: DPR 2.0
 *   - 50 <= FPS <= 57: DPR 1.5
 *   - 40 <= FPS <= 49: DPR 1.25
 *   - FPS < 40: DPR 1.0
 * - Estabilidade: Cooldown de 3.0s após qualquer alteração e passo máximo de 1 nível por vez.
 */

const DPR_LEVELS = [1.0, 1.25, 1.5, 2.0];

export function createAdaptiveDPR(initialRenderers = [], options = {}) {
  const rendererList = Array.isArray(initialRenderers)
    ? [...initialRenderers]
    : initialRenderers ? [initialRenderers] : [];

  let currentLevelIndex = 2; // Inicia em 1.5
  let currentDPR = DPR_LEVELS[currentLevelIndex];

  const WINDOW_DURATION_MS = 2500;
  const COOLDOWN_DURATION_MS = 3000;
  const frameTimestamps = [];
  let lastChangeTime = performance.now();

  function applyDPR(dpr) {
    currentDPR = dpr;
    rendererList.forEach((r) => {
      if (r && typeof r.setPixelRatio === 'function') {
        r.setPixelRatio(dpr);
      }
    });
    if (typeof options.onDPRChange === 'function') {
      options.onDPRChange(dpr);
    }
  }

  // Aplicar estado inicial (1.5)
  applyDPR(currentDPR);

  function update(now = performance.now()) {
    frameTimestamps.push(now);

    // Manter apenas registros dos últimos 2.5s
    const cutoff = now - WINDOW_DURATION_MS;
    while (frameTimestamps.length > 0 && frameTimestamps[0] < cutoff) {
      frameTimestamps.shift();
    }

    // Respeitar período de cooldown de 3 segundos pós-alteração
    if (now - lastChangeTime < COOLDOWN_DURATION_MS) {
      return currentDPR;
    }

    // Exigir pelo menos 1.5s de amostras acumuladas (~30 frames)
    if (frameTimestamps.length < 30) {
      return currentDPR;
    }

    const firstTime = frameTimestamps[0];
    const durationSec = (now - firstTime) / 1000;
    if (durationSec < 1.5) {
      return currentDPR;
    }

    const frameCount = frameTimestamps.length - 1;
    const avgFPS = frameCount / durationSec;

    // Determinar o nível-alvo com base nas regras
    let targetLevelIndex = currentLevelIndex;

    if (avgFPS >= 58) {
      targetLevelIndex = 3; // 2.0
    } else if (avgFPS >= 50) {
      targetLevelIndex = 2; // 1.5
    } else if (avgFPS >= 40) {
      targetLevelIndex = 1; // 1.25
    } else {
      targetLevelIndex = 0; // 1.0
    }

    // Limitar o nível máximo ao hardware da tela (devicePixelRatio max 2.0)
    const maxHardwareDPR = Math.min(window.devicePixelRatio || 1, 2.0);
    while (targetLevelIndex > 0 && DPR_LEVELS[targetLevelIndex] > maxHardwareDPR) {
      targetLevelIndex--;
    }

    // Se o nível for diferente, alterar APENAS 1 passo por vez
    if (targetLevelIndex !== currentLevelIndex) {
      if (targetLevelIndex > currentLevelIndex) {
        currentLevelIndex += 1;
      } else {
        currentLevelIndex -= 1;
      }

      const newDPR = DPR_LEVELS[currentLevelIndex];
      lastChangeTime = now;
      frameTimestamps.length = 0;

      applyDPR(newDPR);
    }

    return currentDPR;
  }

  return {
    update,
    getCurrentDPR: () => currentDPR,
    addRenderer: (r) => {
      if (r && !rendererList.includes(r)) {
        rendererList.push(r);
        r.setPixelRatio(currentDPR);
      }
    }
  };
}
