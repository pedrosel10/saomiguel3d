import gsap from 'gsap';

let isSplit = false;

export function initTextDisintegration() {
  if (isSplit) return;

  const selectors = ['.location-text', '.brand-subtitle', '#brand-title'];
  let foundAny = false;

  selectors.forEach(sel => {
    const el = document.querySelector(sel);
    if (el) {
      splitElementIntoWordsAndChars(el);
      foundAny = true;
    }
  });

  if (foundAny) {
    isSplit = true;
  }
}

function splitElementIntoWordsAndChars(element) {
  const childNodes = Array.from(element.childNodes);
  let finalHtml = '';

  childNodes.forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName.toLowerCase() === 'br') {
      finalHtml += '<br>';
      return;
    }

    const textContent = node.textContent || '';
    // Divide o texto mantendo blocos de palavras e espaços
    const tokens = textContent.split(/(\s+)/);

    tokens.forEach(token => {
      if (!token) return;

      if (/^\s+$/.test(token)) {
        // Espaço normal entre palavras para manter o fluxo do parágrafo 100% perfeito
        finalHtml += ' ';
      } else {
        // Palavra inteira encapsulada com white-space: nowrap para NUNCA quebrar no meio
        let wordCharsHtml = '';
        for (let char of token) {
          wordCharsHtml += `<span class="disintegrate-char">${char}</span>`;
        }
        finalHtml += `<span class="disintegrate-word">${wordCharsHtml}</span>`;
      }
    });
  });

  element.innerHTML = finalHtml;
}

export function animateDisintegrateHeroText() {
  initTextDisintegration();

  const chars = document.querySelectorAll('.header-brand .disintegrate-char, .footer-description .disintegrate-char');
  const logoImg = document.querySelector('.hero-logo-img');

  // 1. Textos da tela inicial: Fade out leve e rápido letra por letra (sem blur)
  if (chars.length > 0) {
    gsap.killTweensOf(chars);
    gsap.to(chars, {
      opacity: 0,
      y: () => (Math.random() - 0.5) * 12,
      x: () => (Math.random() - 0.5) * 8,
      duration: 0.35,
      stagger: {
        amount: 0.25,
        from: 'random'
      },
      ease: 'power2.in'
    });
  }

  // 2. Logo SVG do canto: Subindo pra cima com máscara GSAP
  if (logoImg) {
    gsap.killTweensOf(logoImg);
    gsap.to(logoImg, {
      y: '-115%',
      opacity: 0,
      duration: 0.45,
      ease: 'power2.in'
    });
  }
}

export function animateReintegrateHeroText() {
  initTextDisintegration();

  const chars = document.querySelectorAll('.header-brand .disintegrate-char, .footer-description .disintegrate-char');
  const logoImg = document.querySelector('.hero-logo-img');

  // 1. Textos da tela inicial: Reaparecer remontando letra por letra de forma leve
  if (chars.length > 0) {
    gsap.killTweensOf(chars);
    gsap.to(chars, {
      opacity: 1,
      x: 0,
      y: 0,
      duration: 0.45,
      stagger: {
        amount: 0.25,
        from: 'start'
      },
      ease: 'power2.out',
      delay: 0.1
    });
  }

  // 2. Logo SVG do canto: Aparecer descendo através da máscara GSAP
  if (logoImg) {
    gsap.killTweensOf(logoImg);
    gsap.fromTo(
      logoImg,
      { y: '-115%', opacity: 0 },
      { y: '0%', opacity: 1, duration: 0.55, ease: 'power3.out', delay: 0.2 }
    );
  }
}
