import gsap from 'gsap';

let triggerRevealFn = null;

export function animateFoldSlideUp(sectionId = 'team') {
  const foldSection = document.getElementById(sectionId);
  if (!foldSection) return;

  const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);

  // Garante que o scroll interno do painel inicie no topo
  foldSection.scrollTop = 0;

  // Animação GSAP do painel da dobra subindo com aceleração por GPU
  gsap.fromTo(
    foldSection,
    {
      y: '100vh',
      opacity: 1
    },
    {
      y: '0vh',
      duration: isMobile ? 2.2 : 2.6,
      ease: 'power2.inOut',
      force3D: true,
      onStart: () => {
        if (triggerRevealFn) triggerRevealFn(sectionId);
      },
      onComplete: () => {
        window.dispatchEvent(new CustomEvent('foldSlideUpComplete', { detail: { id: sectionId } }));
      }
    }
  );
}

export function animateFoldSlideDown(sectionId = 'team') {
  const foldSection = document.getElementById(sectionId);
  if (!foldSection) return;

  const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);

  // Animação GSAP recolhendo o painel de volta para o fundo
  gsap.to(foldSection, {
    y: '100vh',
    duration: isMobile ? 1.0 : 1.3,
    ease: 'power2.inOut',
    force3D: true
  });
}

export function setupTeamFold() {
  const initSectionReveal = (sectionEl) => {
    if (!sectionEl) return () => {};

    const subLine = sectionEl.querySelector('.subheading__line');
    const subText = sectionEl.querySelector('.subheading__text');
    const img1 = sectionEl.querySelector('.team__img, .system__slide-img');
    const txtWrap = sectionEl.querySelector('.team__txt-wrap, .system__slide-txt-wrap');
    const advant = sectionEl.querySelector('.team__advant, .system__rich');
    const advantTxtWraps = sectionEl.querySelectorAll('.team__advant-txt-wrap, .system__rich li');

    if (subLine) subLine.style.width = "0%";
    if (subText) subText.style.width = "0px";
    if (img1) {
      img1.style.height = "0px";
      img1.style.transform = "scale(1.4)";
    }
    if (txtWrap) txtWrap.style.opacity = "0";
    if (advant) advant.style.opacity = "0";

    advantTxtWraps.forEach(el => {
      el.style.transform = "translate3d(-110%, 0, 0)";
      el.style.opacity = "0";
    });

    return () => {
      setTimeout(() => {
        if (subLine) subLine.style.width = "100%";
        if (subText) subText.style.width = "auto";
      }, 100);

      setTimeout(() => {
        if (img1) {
          img1.style.height = "100%";
          img1.style.transform = "scale(1)";
        }
      }, 300);

      setTimeout(() => {
        if (txtWrap) txtWrap.style.opacity = "1";
        if (advant) advant.style.opacity = "1";

        advantTxtWraps.forEach((el, index) => {
          setTimeout(() => {
            el.style.transform = "translate3d(0, 0, 0)";
            el.style.opacity = "1";
          }, index * 150);
        });
      }, 500);
    };
  };

  const teamSection = document.querySelector('[data-observ="team"]');
  const servicosSection = document.querySelector('[data-observ="servicos"]');
  const clientesSection = document.querySelector('[data-observ="clientes"]');

  const triggerTeamReveal = initSectionReveal(teamSection);
  const triggerServicosReveal = initSectionReveal(servicosSection);
  const triggerClientesReveal = initSectionReveal(clientesSection);

  triggerRevealFn = (sectionId = 'team') => {
    if (sectionId === 'servicos') {
      triggerServicosReveal();
    } else if (sectionId === 'clientes') {
      triggerClientesReveal();
    } else {
      triggerTeamReveal();
    }
  };

  // 1. Lógica das Abas da Dobra de Serviços (Construção | Projetos | PPCI)
  const tabButtons = document.querySelectorAll(".system__tab-link");
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
        } else {
          pane.classList.remove("active");
        }
      });
    });
  });

  // 2. Lógica de Drag & Scroll da Galeria de Clientes (Sweep Blue + Progresso 01/08)
  const clientesCarousel = document.getElementById("clientes-carousel");
  const clientesProgressFill = document.getElementById("clientes-progress-fill");
  const numDisplay = document.querySelector(".current-slide-num");

  if (clientesCarousel) {
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    clientesCarousel.addEventListener('mousedown', (e) => {
      isDown = true;
      startX = e.pageX - clientesCarousel.offsetLeft;
      scrollLeft = clientesCarousel.scrollLeft;
    });

    clientesCarousel.addEventListener('mouseleave', () => { isDown = false; });
    clientesCarousel.addEventListener('mouseup', () => { isDown = false; });

    clientesCarousel.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - clientesCarousel.offsetLeft;
      const walk = (x - startX) * 1.8;
      clientesCarousel.scrollLeft = scrollLeft - walk;
    });

    const updateClientesProgress = () => {
      const maxScroll = clientesCarousel.scrollWidth - clientesCarousel.clientWidth;
      if (maxScroll <= 0) return;

      const percentage = clientesCarousel.scrollLeft / maxScroll;
      if (clientesProgressFill) {
        clientesProgressFill.style.width = `${Math.max(12.5, percentage * 100)}%`;
      }

      const currentSlide = Math.min(8, Math.max(1, Math.round(percentage * 7) + 1));
      if (numDisplay) {
        numDisplay.textContent = currentSlide < 10 ? `0${currentSlide}` : `${currentSlide}`;
      }

      // Ativar a varredura Sweep Blue no card do logo do cliente visível
      const slides = clientesCarousel.querySelectorAll('.swiper-slide.mod--gallery');
      slides.forEach((slide, idx) => {
        const logoCard = slide.querySelector('.client-logo-card');
        if (logoCard) {
          if (idx + 1 === currentSlide) {
            logoCard.classList.add('active');
          } else {
            logoCard.classList.remove('active');
          }
        }
      });
    };

    clientesCarousel.addEventListener("scroll", updateClientesProgress, { passive: true });
    updateClientesProgress();
  }

  // 3. Botões Fechar / Voltar de todas as dobras
  const closeBtns = document.querySelectorAll(".team-close-btn, .fold-close-btn");
  closeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const sectionId = btn.getAttribute("data-close") || "team";
      window.dispatchEvent(new CustomEvent('calloutClose', { detail: { id: sectionId } }));
    });
  });
}

