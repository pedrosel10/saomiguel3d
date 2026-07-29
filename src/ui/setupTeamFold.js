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

export function animateFoldSlideUp(sectionId = 'team') {
  currentActiveSectionId = sectionId;
  const foldSection = document.getElementById(sectionId);
  if (!foldSection) return;

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

  foldSection.scrollTop = 0;
  gsap.set(foldSection, {
    y: '0%',
    opacity: 1
  });

  if (triggerRevealFn) triggerRevealFn(sectionId);
  animateCraneHookIn();
  window.dispatchEvent(new CustomEvent('foldSlideUpComplete', { detail: { id: sectionId } }));
}

export function hideFoldInstant(sectionId) {
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
      force3D: true
    });
  });
}

export function setupTeamFold() {
  const initSectionReveal = (sectionEl) => {
    if (!sectionEl) return () => {};

    const subLine = sectionEl.querySelector('.fold-subheading__line');
    const subText = sectionEl.querySelector('.fold-subheading__text');
    const headings = sectionEl.querySelectorAll('.fold-title, .service-title, .showcase-name');
    const paragraphs = sectionEl.querySelectorAll('.fold-p, .service-list li, .contact-link');
    const images = sectionEl.querySelectorAll('.editorial-img, .showcase-img');
    const cards = sectionEl.querySelectorAll('.stat-block, .client-showcase, .service-block, .social-btn, .tab-pill');

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

  const contatoVideo = document.querySelector('#contato video');
  if (contatoVideo) {
    contatoVideo.pause();
  }

  const teamSection = document.querySelector('[data-observ="team"]');
  const servicosSection = document.querySelector('[data-observ="servicos"]');
  const clientesSection = document.querySelector('[data-observ="clientes"]');
  const contatoSection = document.querySelector('[data-observ="contato"]');

  const triggerTeamReveal = initSectionReveal(teamSection);
  const triggerServicosReveal = initSectionReveal(servicosSection);
  const triggerClientesReveal = initSectionReveal(clientesSection);
  const triggerContatoReveal = initSectionReveal(contatoSection);

  triggerRevealFn = (sectionId = 'team') => {
    if (contatoVideo) {
      if (sectionId === 'contato') {
        contatoVideo.play().catch(() => {});
      } else {
        contatoVideo.pause();
      }
    }

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

  // Galeria de Clientes agora é um CSS Grid (não precisa de drag/scroll em JS)

  // 3. Botões Fechar / Voltar de todas as dobras com animação de subida do gancho
  const closeBtns = document.querySelectorAll(".fold-close-btn");
  closeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const sectionId = btn.getAttribute("data-close") || "team";
      if (contatoVideo && sectionId === 'contato') {
        contatoVideo.pause();
      }
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
