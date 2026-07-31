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
    const paragraphs = sectionEl.querySelectorAll('.fold-p, .service-list li');
    const images = sectionEl.querySelectorAll('.editorial-img');
    const cards = sectionEl.querySelectorAll('.stat-block, .service-block, .social-btn, .tab-pill, .contact-card, .contact-separator');

    // Galeria editorial de clientes
    const featuredCards = sectionEl.querySelectorAll('.client-featured');
    const compactCards = sectionEl.querySelectorAll('.client-compact');
    const logoCards = sectionEl.querySelectorAll('.client-logo-card');

    // Configuração Inicial (antes de aparecer)
    if (subLine) gsap.set(subLine, { width: 0 });
    if (subText) gsap.set(subText, { opacity: 0, x: -10 });
    if (headings.length) gsap.set(headings, { opacity: 0, y: 20 });
    if (paragraphs.length) gsap.set(paragraphs, { opacity: 0, y: 15 });
    if (images.length) gsap.set(images, { opacity: 0, scale: 1.03 });
    if (cards.length) gsap.set(cards, { opacity: 0, y: 20 });
    if (featuredCards.length) gsap.set(featuredCards, { opacity: 0, y: 40 });
    if (compactCards.length) gsap.set(compactCards, { opacity: 0, y: 30, scale: 0.96 });

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

      // Galeria editorial de clientes: stagger reveal
      if (featuredCards.length) {
        tl.to(featuredCards, {
          opacity: 1, y: 0, duration: 0.9, stagger: 0.2, ease: 'power3.out'
        }, 0.3);
      }

      if (compactCards.length) {
        tl.to(compactCards, {
          opacity: 1, y: 0, scale: 1, duration: 0.7, stagger: 0.08, ease: 'power2.out'
        }, featuredCards.length ? 0.7 : 0.3);
      }

      // Sweep animation em TODOS os logo badges ao entrar na dobra
      if (logoCards.length) {
        // Reset: remove active para re-triggerar a animação
        logoCards.forEach(card => card.classList.remove('active'));

        // Featured logos primeiro, depois compact logos com delay crescente
        logoCards.forEach((card, i) => {
          setTimeout(() => card.classList.add('active'), 700 + i * 200);
        });
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

