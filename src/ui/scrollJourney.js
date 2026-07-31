import { brickTransition } from '../effects/brickTransition.js';
import { switchFoldInstant } from './setupTeamFold.js';
import { updateScrollProgress, hideScrollProgress } from './scrollPullIndicator.js';

const JOURNEY_SEQUENCE = ['team', 'servicos', 'clientes', 'contato'];

const foldIdMap = {
  'equipe': 'team',
  'team': 'team',
  'servicos': 'servicos',
  'cases': 'clientes',
  'clientes': 'clientes',
  'contato': 'contato'
};

const foldNextLabels = {
  null: 'Sobre a Equipe',
  'team': 'Serviços',
  'servicos': 'Clientes',
  'clientes': 'Contato',
  'contato': 'Tela Inicial'
};

export function setupScrollJourney(options = {}) {
  const { onStartJourney, onReturnToHero } = options;

  let activeFoldId = null; // null = Dobra 1 (Hero 3D)
  let isTransitioning = false;
  let accumulatedDelta = 0;
  let resetTimer = null;

  let isAtBottom = false;
  let bottomReachedTime = 0;

  const HERO_WHEEL_THRESHOLD = 950;
  const HERO_TOUCH_THRESHOLD = 120;
  const SECTION_WHEEL_THRESHOLD = 850;
  const SECTION_TOUCH_THRESHOLD = 90;

  let decayAnimationFrame = null;
  let decayTimer = null;

  function stopDecay() {
    if (decayTimer) {
      clearTimeout(decayTimer);
      decayTimer = null;
    }
    if (decayAnimationFrame) {
      cancelAnimationFrame(decayAnimationFrame);
      decayAnimationFrame = null;
    }
  }

  function startDecay(currentThreshold) {
    stopDecay();

    function step() {
      if (isTransitioning) {
        decayAnimationFrame = null;
        return;
      }
      if (accumulatedDelta <= 2) {
        accumulatedDelta = 0;
        hideScrollProgress();
        decayAnimationFrame = null;
        return;
      }

      // Recuo elástico da barrinha se soltar no meio (20% por frame)
      accumulatedDelta *= 0.80;
      notifyProgress(currentThreshold);

      decayAnimationFrame = requestAnimationFrame(step);
    }

    decayAnimationFrame = requestAnimationFrame(step);
  }

  function scheduleDecay(currentThreshold) {
    if (decayTimer) clearTimeout(decayTimer);
    decayTimer = setTimeout(() => {
      startDecay(currentThreshold);
    }, 90);
  }

  function resetAccumulator() {
    stopDecay();
    accumulatedDelta = 0;
    hideScrollProgress();
  }

  function notifyProgress(currentThreshold) {
    if (brickTransition.animating) {
      hideScrollProgress();
      return;
    }
    const progress = Math.min(accumulatedDelta / currentThreshold, 1.0);
    const isThresholdReached = progress >= 0.99;
    const nextFoldLabel = foldNextLabels[activeFoldId] || 'Próxima seção';

    updateScrollProgress({
      progress,
      isThresholdReached,
      nextFoldLabel,
      direction: activeFoldId === 'contato' ? 'up' : 'down'
    });
  }

  function resetBottomState() {
    isAtBottom = false;
    bottomReachedTime = 0;
  }

  // Ouvinte para quando a abertura de qualquer dobra for concluída
  window.addEventListener('foldSlideUpComplete', (event) => {
    const data = event.detail;
    if (data && data.id) {
      activeFoldId = data.id;
    }
    isTransitioning = false;
    resetBottomState();
    resetAccumulator();
  });

  // Ouvinte de clique em Callouts 3D
  window.addEventListener('calloutClick', (event) => {
    const data = event.detail;
    if (data && data.id) {
      const mappedId = foldIdMap[data.id] || data.id;
      activeFoldId = mappedId;
    }
    resetBottomState();
    resetAccumulator();
  });

  const handleHeroReturned = () => {
    activeFoldId = null;
    isTransitioning = false;
    resetBottomState();
    resetAccumulator();
  };

  // Ouvinte para fechar/voltar de qualquer dobra (botão VOLTAR ou encerramento da saída)
  window.addEventListener('calloutClose', handleHeroReturned);
  window.addEventListener('foldClosed', handleHeroReturned);

  // Trata a transição sequencial entre dobras via Tijolos Azuis ou retorno para a tela inicial
  function triggerNextFold(currentId) {
    const currentIndex = JOURNEY_SEQUENCE.indexOf(currentId);

    // Se estiver no Contato (última dobra da jornada), voltar para a Tela Inicial Hero 3D!
    if (currentIndex === JOURNEY_SEQUENCE.length - 1 || currentId === 'contato') {
      isTransitioning = true;
      resetBottomState();
      resetAccumulator();
      if (typeof onReturnToHero === 'function') {
        onReturnToHero(currentId);
      } else {
        window.dispatchEvent(new CustomEvent('calloutClose', { detail: { id: currentId } }));
      }
      return;
    }

    const nextId = JOURNEY_SEQUENCE[currentIndex + 1];
    if (!nextId) {
      isTransitioning = false;
      resetAccumulator();
      return;
    }

    isTransitioning = true;
    resetBottomState();

    brickTransition.startTransition(
      () => {
        resetAccumulator();
        switchFoldInstant(currentId, nextId);
        activeFoldId = nextId;
      },
      () => {
        isTransitioning = false;
      }
    );
  }

  // Verifica se a seção tem conteúdo scrollável (altura > viewport)
  function isSectionScrollable(sectionEl) {
    if (!sectionEl) return false;
    return sectionEl.scrollHeight > sectionEl.clientHeight + 15;
  }

  // Verifica se a seção está no fundo
  function checkAtBottom(sectionEl) {
    if (!sectionEl) return false;
    if (!isSectionScrollable(sectionEl)) {
      // Se não precisa de scrollbar (conteúdo cabe na tela, ex: Contato), já está no fundo!
      return true;
    }
    const currentScrollTop = Math.ceil(sectionEl.scrollTop);
    const maxScrollTop = sectionEl.scrollHeight - sectionEl.clientHeight;
    return (currentScrollTop >= maxScrollTop - 25);
  }

  // Processamento de Scroll Wheel (Desktop)
  window.addEventListener('wheel', (event) => {
    if (isTransitioning || brickTransition.animating) {
      return;
    }

    const deltaY = event.deltaY;

    // Scroll para cima: inicia recuo da barra se houver progresso acumulado
    if (deltaY <= 0) {
      resetBottomState();
      if (accumulatedDelta > 0) {
        startDecay(activeFoldId === null ? HERO_WHEEL_THRESHOLD : SECTION_WHEEL_THRESHOLD);
      } else {
        resetAccumulator();
      }
      return;
    }

    // Fator de peso pesadíssimo na rolagem (0.45x)
    const weightedDelta = deltaY * 0.45;

    // CASO 1: Tela Inicial Hero 3D (Dobra 1)
    if (activeFoldId === null) {
      stopDecay();
      accumulatedDelta += weightedDelta;
      notifyProgress(HERO_WHEEL_THRESHOLD);

      if (accumulatedDelta >= HERO_WHEEL_THRESHOLD) {
        stopDecay();
        isTransitioning = true;
        accumulatedDelta = HERO_WHEEL_THRESHOLD;
        notifyProgress(HERO_WHEEL_THRESHOLD);
        setTimeout(() => {
          activeFoldId = 'team';
          if (typeof onStartJourney === 'function') {
            onStartJourney('team');
          }
        }, 180);
        return;
      }

      scheduleDecay(HERO_WHEEL_THRESHOLD);
      return;
    }

    // CASO 2: Dentro de uma Dobra
    const sectionEl = document.getElementById(activeFoldId);
    if (!sectionEl) return;

    const currentlyAtBottom = checkAtBottom(sectionEl);

    if (!currentlyAtBottom) {
      resetBottomState();
      if (accumulatedDelta > 0) {
        startDecay(SECTION_WHEEL_THRESHOLD);
      } else {
        resetAccumulator();
      }
      return;
    }

    // Acumular tração ultra-pesada no fundo da dobra
    stopDecay();
    accumulatedDelta += weightedDelta;
    notifyProgress(SECTION_WHEEL_THRESHOLD);

    if (accumulatedDelta >= SECTION_WHEEL_THRESHOLD) {
      stopDecay();
      isTransitioning = true;
      accumulatedDelta = SECTION_WHEEL_THRESHOLD;
      notifyProgress(SECTION_WHEEL_THRESHOLD);
      const currentFold = activeFoldId;
      setTimeout(() => {
        triggerNextFold(currentFold);
      }, 180);
      return;
    }

    scheduleDecay(SECTION_WHEEL_THRESHOLD);
  }, { passive: true });

  // Processamento de Gestos Touch (Mobile / Tablet)
  let touchStartY = 0;

  window.addEventListener('touchstart', (event) => {
    if (event.touches.length > 0) {
      touchStartY = event.touches[0].clientY;
    }
  }, { passive: true });

  window.addEventListener('touchmove', (event) => {
    if (isTransitioning || brickTransition.animating || event.touches.length === 0) {
      return;
    }

    const currentY = event.touches[0].clientY;
    const deltaY = touchStartY - currentY; // Positivo ao deslizar para cima (scroll down)

    if (deltaY <= 0) {
      resetBottomState();
      if (accumulatedDelta > 0) {
        startDecay(activeFoldId === null ? HERO_TOUCH_THRESHOLD : SECTION_TOUCH_THRESHOLD);
      } else {
        resetAccumulator();
      }
      touchStartY = currentY;
      return;
    }

    const weightedDelta = deltaY * 1.0;

    // CASO 1: Tela Inicial Hero 3D
    if (activeFoldId === null) {
      stopDecay();
      accumulatedDelta += weightedDelta;
      touchStartY = currentY;
      notifyProgress(HERO_TOUCH_THRESHOLD);

      if (accumulatedDelta >= HERO_TOUCH_THRESHOLD) {
        stopDecay();
        isTransitioning = true;
        accumulatedDelta = HERO_TOUCH_THRESHOLD;
        notifyProgress(HERO_TOUCH_THRESHOLD);
        setTimeout(() => {
          activeFoldId = 'team';
          if (typeof onStartJourney === 'function') {
            onStartJourney('team');
          }
        }, 180);
        return;
      }

      scheduleDecay(HERO_TOUCH_THRESHOLD);
      return;
    }

    // CASO 2: Dentro de uma Dobra
    const sectionEl = document.getElementById(activeFoldId);
    if (!sectionEl) return;

    const currentlyAtBottom = checkAtBottom(sectionEl);

    if (!currentlyAtBottom) {
      resetBottomState();
      if (accumulatedDelta > 0) {
        startDecay(SECTION_TOUCH_THRESHOLD);
      } else {
        resetAccumulator();
      }
      touchStartY = currentY;
      return;
    }

    stopDecay();
    accumulatedDelta += weightedDelta;
    touchStartY = currentY;
    notifyProgress(SECTION_TOUCH_THRESHOLD);

    if (accumulatedDelta >= SECTION_TOUCH_THRESHOLD) {
      stopDecay();
      isTransitioning = true;
      accumulatedDelta = SECTION_TOUCH_THRESHOLD;
      notifyProgress(SECTION_TOUCH_THRESHOLD);
      const currentFold = activeFoldId;
      setTimeout(() => {
        triggerNextFold(currentFold);
      }, 180);
      return;
    }

    scheduleDecay(SECTION_TOUCH_THRESHOLD);
  }, { passive: true });

  return {
    resetJourneyState: () => {
      activeFoldId = null;
      isTransitioning = false;
      resetBottomState();
      resetAccumulator();
    }
  };
}
