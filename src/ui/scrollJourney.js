import { brickTransition } from '../effects/brickTransition.js';
import { switchFoldInstant } from './setupTeamFold.js';

const JOURNEY_SEQUENCE = ['team', 'servicos', 'clientes', 'contato'];

const foldIdMap = {
  'equipe': 'team',
  'team': 'team',
  'servicos': 'servicos',
  'cases': 'clientes',
  'clientes': 'clientes',
  'contato': 'contato'
};

export function setupScrollJourney(options = {}) {
  const { onStartJourney, onReturnToHero } = options;

  let activeFoldId = null; // null = Dobra 1 (Hero 3D)
  let isTransitioning = false;
  let accumulatedDelta = 0;
  let resetTimer = null;

  let isAtBottom = false;
  let bottomReachedTime = 0;

  const HERO_WHEEL_THRESHOLD = 140;
  const HERO_TOUCH_THRESHOLD = 90;
  const SECTION_WHEEL_THRESHOLD = 110;
  const SECTION_TOUCH_THRESHOLD = 70;
  const REST_REQUIRED_MS = 300;

  function resetAccumulator() {
    accumulatedDelta = 0;
    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }
  }

  function scheduleReset() {
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      accumulatedDelta = 0;
    }, 500);
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
    if (isTransitioning) return;

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
    isTransitioning = true;
    resetBottomState();
    resetAccumulator();

    brickTransition.startTransition(
      () => {
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

    // Scroll para cima: ignora e reseta estado do fundo
    if (deltaY <= 0) {
      resetBottomState();
      resetAccumulator();
      return;
    }

    // CASO 1: Tela Inicial Hero 3D (Dobra 1)
    if (activeFoldId === null) {
      accumulatedDelta += deltaY;
      scheduleReset();

      if (accumulatedDelta >= HERO_WHEEL_THRESHOLD) {
        resetAccumulator();
        isTransitioning = true;
        activeFoldId = 'team';
        if (typeof onStartJourney === 'function') {
          onStartJourney('team');
        }
      }
      return;
    }

    // CASO 2: Dentro de uma Dobra
    const sectionEl = document.getElementById(activeFoldId);
    if (!sectionEl) return;

    const currentlyAtBottom = checkAtBottom(sectionEl);

    if (!currentlyAtBottom) {
      resetBottomState();
      resetAccumulator();
      return;
    }

    const scrollable = isSectionScrollable(sectionEl);
    const now = Date.now();

    // Se for uma seção com scrollbar, exige a primeira batida no fundo para descarte
    if (scrollable) {
      if (!isAtBottom) {
        isAtBottom = true;
        bottomReachedTime = now;
        resetAccumulator();
        return;
      }

      if (now - bottomReachedTime < REST_REQUIRED_MS) {
        resetAccumulator();
        return;
      }
    }

    // Se for uma seção sem scrollbar (Contato) ou já tiver repousado no fundo:
    accumulatedDelta += deltaY;
    scheduleReset();

    if (accumulatedDelta >= SECTION_WHEEL_THRESHOLD) {
      triggerNextFold(activeFoldId);
    }
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
      resetAccumulator();
      touchStartY = currentY;
      return;
    }

    // CASO 1: Tela Inicial Hero 3D
    if (activeFoldId === null) {
      accumulatedDelta += deltaY;
      touchStartY = currentY;
      scheduleReset();

      if (accumulatedDelta >= HERO_TOUCH_THRESHOLD) {
        resetAccumulator();
        isTransitioning = true;
        activeFoldId = 'team';
        if (typeof onStartJourney === 'function') {
          onStartJourney('team');
        }
      }
      return;
    }

    // CASO 2: Dentro de uma Dobra
    const sectionEl = document.getElementById(activeFoldId);
    if (!sectionEl) return;

    const currentlyAtBottom = checkAtBottom(sectionEl);

    if (!currentlyAtBottom) {
      resetBottomState();
      resetAccumulator();
      touchStartY = currentY;
      return;
    }

    const scrollable = isSectionScrollable(sectionEl);
    const now = Date.now();

    if (scrollable) {
      if (!isAtBottom) {
        isAtBottom = true;
        bottomReachedTime = now;
        resetAccumulator();
        touchStartY = currentY;
        return;
      }

      if (now - bottomReachedTime < REST_REQUIRED_MS) {
        resetAccumulator();
        touchStartY = currentY;
        return;
      }
    }

    accumulatedDelta += deltaY;
    touchStartY = currentY;
    scheduleReset();

    if (accumulatedDelta >= SECTION_TOUCH_THRESHOLD) {
      triggerNextFold(activeFoldId);
    }
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
