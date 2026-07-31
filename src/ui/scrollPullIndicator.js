/**
 * scrollPullIndicator.js
 * Indicador visual minimalista e sensorial de Pull-to-Transition no rodapé.
 * Sem textos, com anel SVG expandido e brilho azul (glow) proporcional de 0 a 100%.
 */

let indicatorEl = null;
let fgCircleEl = null;
let arrowIconEl = null;
let ambientGlowEl = null;

// Raio = 20px -> Circunferência = 2 * PI * 20 = 125.6637
const CIRCUMFERENCE = 125.6637;

export function initScrollPullIndicator() {
  if (document.getElementById('scroll-pull-indicator')) {
    indicatorEl = document.getElementById('scroll-pull-indicator');
    fgCircleEl = indicatorEl.querySelector('.pull-fg-circle');
    arrowIconEl = indicatorEl.querySelector('.pull-arrow-icon');
    ambientGlowEl = indicatorEl.querySelector('.pull-ambient-glow');
    return;
  }

  const container = document.createElement('div');
  container.id = 'scroll-pull-indicator';
  container.className = 'scroll-pull-indicator';
  container.setAttribute('aria-hidden', 'true');

  container.innerHTML = `
    <div class="pull-ambient-glow"></div>
    <div class="pull-indicator-inner">
      <div class="pull-progress-ring">
        <svg class="pull-svg" viewBox="0 0 48 48">
          <circle class="pull-bg-circle" cx="24" cy="24" r="20" />
          <circle class="pull-fg-circle" cx="24" cy="24" r="20" />
        </svg>
        <div class="pull-icon-wrap">
          <svg class="pull-arrow-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  indicatorEl = container;
  fgCircleEl = container.querySelector('.pull-fg-circle');
  arrowIconEl = container.querySelector('.pull-arrow-icon');
  ambientGlowEl = container.querySelector('.pull-ambient-glow');

  if (fgCircleEl) {
    fgCircleEl.style.strokeDasharray = `${CIRCUMFERENCE}`;
    fgCircleEl.style.strokeDashoffset = `${CIRCUMFERENCE}`;
  }
}

/**
 * Atualiza o progresso do anel e o glow azul proporcional no fundo (0 a 100%).
 */
export function updateScrollProgress(options = {}) {
  const {
    progress = 0,
    isThresholdReached = false,
    direction = 'down'
  } = options;

  if (!indicatorEl) {
    initScrollPullIndicator();
  }

  if (progress <= 0.02) {
    hideScrollProgress();
    return;
  }

  indicatorEl.classList.add('visible');

  const clampedProgress = Math.min(Math.max(progress, 0), 1.0);
  const offset = CIRCUMFERENCE - (clampedProgress * CIRCUMFERENCE);
  if (fgCircleEl) {
    fgCircleEl.style.strokeDashoffset = `${offset}`;
  }

  // Atualizar brilho azul sensorial no fundo proporcional ao progresso (0 a 100%)
  if (ambientGlowEl) {
    const opacity = Math.min(clampedProgress * 1.1, 1.0);
    const scale = 0.7 + (clampedProgress * 0.7); // 0.7x -> 1.4x
    ambientGlowEl.style.opacity = `${opacity}`;
    ambientGlowEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }

  if (arrowIconEl) {
    arrowIconEl.style.transform = direction === 'up' ? 'rotate(180deg)' : 'rotate(0deg)';
  }

  if (isThresholdReached) {
    indicatorEl.classList.add('is-ready');
  } else {
    indicatorEl.classList.remove('is-ready');
  }
}

/**
 * Esconde e reseta o indicador e o glow.
 */
export function hideScrollProgress() {
  if (!indicatorEl) return;
  indicatorEl.classList.remove('visible', 'is-ready');
  if (fgCircleEl) {
    fgCircleEl.style.strokeDashoffset = `${CIRCUMFERENCE}`;
  }
  if (ambientGlowEl) {
    ambientGlowEl.style.opacity = '0';
    ambientGlowEl.style.transform = 'translate(-50%, -50%) scale(0.6)';
  }
}
