import gsap from 'gsap';

let triggerRevealFn = null;
let currentActiveSectionId = 'team';

function animateCraneHookIn() {
  const wrapper = document.getElementById('global-crane-close');
  if (wrapper) {
    gsap.fromTo(
      wrapper,
      { y: '-130%' },
      { y: '0%', duration: 1.0, ease: 'back.out(1.2)', delay: 0.25 }
    );
  }
}

function showGlobalBgVideo() {
  const globalBgVideo = document.getElementById('global-bg-video');
  if (globalBgVideo) {
    globalBgVideo.classList.add('active');
    const v = globalBgVideo.querySelector('video');
    if (v) v.play().catch(() => {});
  }
}

function hideGlobalBgVideo() {
  const globalBgVideo = document.getElementById('global-bg-video');
  if (globalBgVideo) {
    globalBgVideo.classList.remove('active');
    const v = globalBgVideo.querySelector('video');
    if (v) v.pause();
  }
}

export function animateFoldSlideUp(sectionId = 'team') {
  currentActiveSectionId = sectionId;
  const foldSection = document.getElementById(sectionId);
  if (!foldSection) return;

  showGlobalBgVideo();

  const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);

  // Garante que o scroll interno do painel inicie no topo
  foldSection.scrollTop = 0;

  // Animação GSAP 100% acelerada via GPU usando porcentagem pura y: '100%' -> y: '0%'
  gsap.fromTo(
    foldSection,
    {
      y: '100%',
      opacity: 1
    },
    {
      y: '0%',
      duration: isMobile ? 0.85 : 1.1,
      ease: 'power4.out',
      force3D: true,
      onStart: () => {
        if (triggerRevealFn) triggerRevealFn(sectionId);
        animateCraneHookIn();
      },
      onComplete: () => {
        window.dispatchEvent(new CustomEvent('foldSlideUpComplete', { detail: { id: sectionId } }));
      }
    }
  );
}

export function showFoldInstant(sectionId = 'team') {
  currentActiveSectionId = sectionId;
  const foldSection = document.getElementById(sectionId);
  if (!foldSection) return;

  showGlobalBgVideo();

  foldSection.scrollTop = 0;
  gsap.set(foldSection, {
    y: '0%',
    opacity: 1
  });

  if (triggerRevealFn) triggerRevealFn(sectionId);
  animateCraneHookIn();
  window.dispatchEvent(new CustomEvent('foldSlideUpComplete', { detail: { id: sectionId } }));
}

export function getCurrentActiveSectionId() {
  return currentActiveSectionId;
}

export function switchFoldInstant(fromId, toId) {
  currentActiveSectionId = toId;
  const foldSections = document.querySelectorAll('.section.fold-section');
  foldSections.forEach(sec => {
    if (sec.id === toId) {
      sec.scrollTop = 0;
      gsap.set(sec, { y: '0%', opacity: 1 });
    } else {
      gsap.set(sec, { y: '100%', opacity: 0 });
    }
  });

  if (triggerRevealFn) triggerRevealFn(toId);
  window.dispatchEvent(new CustomEvent('foldSlideUpComplete', { detail: { id: toId } }));
}

export function hideFoldInstant(sectionId) {
  hideGlobalBgVideo();

  const wrapper = document.getElementById('global-crane-close');
  if (wrapper) gsap.set(wrapper, { y: '-130%' });

  const foldSections = document.querySelectorAll('.section.fold-section');
  foldSections.forEach(sec => {
    gsap.set(sec, {
      y: '100%',
      opacity: 0
    });
  });
}

export function animateFoldSlideDown(sectionId) {
  const wrapper = document.getElementById('global-crane-close');
  if (wrapper) {
    gsap.to(wrapper, { y: '-130%', duration: 0.4, ease: 'power2.in' });
  }

  const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);

  const foldSections = document.querySelectorAll('.section.fold-section');
  foldSections.forEach(sec => {
    gsap.to(sec, {
      y: '100%',
      duration: isMobile ? 0.75 : 0.95,
      ease: 'power3.inOut',
      force3D: true,
      onComplete: () => {
        hideGlobalBgVideo();
      }
    });
  });
}

export function setupTeamFold() {
  const initSectionReveal = (sectionEl) => {
    if (!sectionEl) return () => {};

    const subLine = sectionEl.querySelector('.fold-subheading__line');
    const subText = sectionEl.querySelector('.fold-subheading__text');
    const headings = sectionEl.querySelectorAll('.fold-title, .service-title');
    const paragraphs = sectionEl.querySelectorAll('.fold-p, .service-list li, .contact-link');
    const images = sectionEl.querySelectorAll('.editorial-img');
    const cards = sectionEl.querySelectorAll('.stat-block, .service-block, .social-btn, .tab-pill');

    // Configuração Inicial (antes de aparecer)
    if (subLine) gsap.set(subLine, { width: 0 });
    if (subText) gsap.set(subText, { opacity: 0, x: -10 });
    if (headings.length) gsap.set(headings, { opacity: 0, y: 20 });
    if (paragraphs.length) gsap.set(paragraphs, { opacity: 0, y: 15 });
    if (images.length) gsap.set(images, { opacity: 0, scale: 1.03 });
    if (cards.length) gsap.set(cards, { opacity: 0, y: 20 });

    return () => {
      const tl = gsap.timeline({ delay: 0.1 });
      
      if (subLine && subText) {
        tl.to(subLine, { width: '100%', duration: 0.6, ease: 'power3.out' }, 0);
        tl.to(subText, { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out' }, 0.2);
      }
      
      if (headings.length) {
        tl.to(headings, { opacity: 1, y: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out' }, 0.2);
      }
      
      if (paragraphs.length) {
        tl.to(paragraphs, { opacity: 1, y: 0, duration: 0.6, stagger: 0.05, ease: 'power2.out' }, 0.3);
      }
      
      if (images.length) {
        tl.to(images, { opacity: 1, scale: 1, duration: 1.2, stagger: 0.1, ease: 'power2.out' }, 0.2);
      }
      
      if (cards.length) {
        tl.to(cards, { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'back.out(1.2)' }, 0.4);
      }
    };
  };


  const teamSection = document.querySelector('[data-observ="team"]');
  const servicosSection = document.querySelector('[data-observ="servicos"]');
  const clientesSection = document.querySelector('[data-observ="clientes"]');
  const contatoSection = document.querySelector('[data-observ="contato"]');

  const triggerTeamReveal = initSectionReveal(teamSection);
  const triggerServicosReveal = initSectionReveal(servicosSection);
  const triggerClientesReveal = initSectionReveal(clientesSection);
  const triggerContatoReveal = initSectionReveal(contatoSection);

  triggerRevealFn = (sectionId = 'team') => {
    showGlobalBgVideo();

    if (sectionId === 'servicos') {
      triggerServicosReveal();
    } else if (sectionId === 'clientes') {
      triggerClientesReveal();
    } else if (sectionId === 'contato') {
      triggerContatoReveal();
    } else {
      triggerTeamReveal();
    }
  };

  // 1. Lógica das Abas da Dobra de Serviços (Construção | Projetos | PPCI)
  const tabButtons = document.querySelectorAll(".tab-pill");
  const tabPanes = document.querySelectorAll(".system__tab");
  const titleHeading = document.getElementById("servicos-dynamic-heading");

  const tabTitles = {
    "tab-1": "Construção",
    "tab-2": "Projetos",
    "tab-3": "PPCI"
  };

  tabButtons.forEach(button => {
    button.addEventListener("click", () => {
      const targetTab = button.getAttribute("data-tab");

      tabButtons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");

      if (titleHeading && tabTitles[targetTab]) {
        titleHeading.style.opacity = "0";
        setTimeout(() => {
          titleHeading.textContent = tabTitles[targetTab];
          titleHeading.style.opacity = "1";
        }, 200);
      }

      tabPanes.forEach(pane => {
        if (pane.id === targetTab) {
          pane.classList.add("active");
          // Re-trigger GSAP stagger for new tab content
          const images = pane.querySelectorAll('.editorial-img');
          const blocks = pane.querySelectorAll('.service-block');
          const lists = pane.querySelectorAll('.service-list li');
          
          gsap.fromTo(images, { opacity: 0, scale: 1.03 }, { opacity: 1, scale: 1, duration: 0.8, stagger: 0.1, ease: 'power2.out' });
          gsap.fromTo(blocks, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out' });
          gsap.fromTo(lists, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.04, ease: 'power2.out', delay: 0.2 });
        } else {
          pane.classList.remove("active");
        }
      });
    });
  });

  // Galeria de Clientes: scroll-driven 3D stacking cards
  initClientesStackEffect();

  // 3. Botões Fechar / Voltar de todas as dobras com animação de subida do gancho
  const closeBtns = document.querySelectorAll(".fold-close-btn");
  closeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const sectionId = btn.getAttribute("data-close") || "team";
      const wrapper = btn.closest('.crane-close-wrapper');
      if (wrapper) {
        gsap.to(wrapper, {
          y: '-130%',
          duration: 0.45,
          ease: 'power2.in',
          onComplete: () => {
            window.dispatchEvent(new CustomEvent('calloutClose', { detail: { id: sectionId } }));
          }
        });
      } else {
        window.dispatchEvent(new CustomEvent('calloutClose', { detail: { id: sectionId } }));
      }
    });
  });
}

/**
 * Scroll-driven 3D Stacking Effect para a Galeria de Clientes.
 * Cards usam position:sticky e animam da direita com rotação 3D
 * conforme o scroll interno da fold-section.
 */
function initClientesStackEffect() {
  const section = document.getElementById('clientes');
  if (!section) return;

  const gallery = section.querySelector('.clients-gallery');
  if (!gallery) return;

  const cards = gallery.querySelectorAll('.client-showcase');
  if (!cards.length) return;

  const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);

  // Parâmetros do efeito
  const CARD_SCROLL_DISTANCE = isMobile ? 140 : 180; // px de scroll por card
  const STICKY_TOP_BASE = isMobile ? 70 : 100;        // px do topo para o primeiro card
  const STICKY_TOP_INCREMENT = isMobile ? 8 : 10;     // px de offset vertical entre cards no stack

  // Configurar sticky positions e margins de scroll
  cards.forEach((card, i) => {
    card.style.position = 'sticky';
    card.style.top = `${STICKY_TOP_BASE + i * STICKY_TOP_INCREMENT}px`;
    card.style.zIndex = i + 1;
    card.style.transformOrigin = 'left center';

    // Margin bottom cria espaço de scroll entre os cards (exceto o último)
    if (i < cards.length - 1) {
      card.style.marginBottom = `${CARD_SCROLL_DISTANCE}px`;
    }

    // Estado inicial: primeiro card visível, demais ocultos à direita
    if (i === 0) {
      card.style.opacity = '1';
      card.style.transform = 'perspective(1200px) translateX(0%) rotateY(0deg) scale(1)';
    } else {
      card.style.opacity = '0';
      card.style.transform = 'perspective(1200px) translateX(80%) rotateY(-18deg) scale(0.9)';
    }
  });

  // Handler de scroll otimizado com requestAnimationFrame
  let ticking = false;

  function updateCardsOnScroll() {
    const scrollTop = section.scrollTop;

    cards.forEach((card, i) => {
      // Primeiro card sempre visível
      if (i === 0) {
        card.style.opacity = '1';
        card.style.transform = 'perspective(1200px) translateX(0%) rotateY(0deg) scale(1)';
        return;
      }

      // Calcular progresso de revelação deste card
      const triggerStart = (i - 1) * CARD_SCROLL_DISTANCE + CARD_SCROLL_DISTANCE * 0.3;
      const triggerEnd = triggerStart + CARD_SCROLL_DISTANCE;
      const rawProgress = (scrollTop - triggerStart) / (triggerEnd - triggerStart);
      const progress = Math.min(Math.max(rawProgress, 0), 1);

      // Ease out cubic para desaceleração natural
      const eased = 1 - Math.pow(1 - progress, 3);

      // Transformações 3D: da direita com rotação até a posição de repouso
      const translateX = (1 - eased) * 80;    // 80% → 0%
      const rotateY = (1 - eased) * -18;       // -18deg → 0deg
      const scale = 0.9 + eased * 0.1;         // 0.9 → 1.0
      const opacity = eased;                    // 0 → 1

      card.style.transform = `perspective(1200px) translateX(${translateX}%) rotateY(${rotateY}deg) scale(${scale})`;
      card.style.opacity = opacity;
    });

    ticking = false;
  }

  section.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateCardsOnScroll);
    }
  }, { passive: true });

  // Listener para re-inicializar quando a dobra abre (scroll reseta para 0)
  window.addEventListener('foldSlideUpComplete', (event) => {
    const data = event.detail;
    if (data && data.id === 'clientes') {
      section.scrollTop = 0;
      requestAnimationFrame(updateCardsOnScroll);
    }
  });
}
