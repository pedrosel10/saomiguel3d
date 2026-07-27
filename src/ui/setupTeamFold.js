import gsap from 'gsap';

let triggerRevealFn = null;

export function animateFoldSlideUp() {
  const teamSection = document.getElementById('team');
  if (!teamSection) return;

  // Garante que o scroll interno do painel inicie no topo
  teamSection.scrollTop = 0;

  // Animação GSAP do painel da equipe subindo como um overlay fixo de baixo para cima (100vh -> 0vh)
  gsap.fromTo(
    teamSection,
    {
      y: '100vh',
      opacity: 1
    },
    {
      y: '0vh',
      duration: 2.0,
      ease: 'power2.inOut',
      onStart: () => {
        if (triggerRevealFn) triggerRevealFn();
      }
    }
  );
}

export function animateFoldSlideDown() {
  const teamSection = document.getElementById('team');
  if (!teamSection) return;

  // Animação GSAP do painel da equipe recolhendo de volta para o fundo da tela (0vh -> 100vh)
  gsap.to(teamSection, {
    y: '100vh',
    duration: 1.3,
    ease: 'power2.inOut'
  });
}

export function setupTeamFold() {
  const teamSection = document.querySelector('[data-observ="team"]');
  if (!teamSection) return;

  // Estado Inicial dos Elementos (Antes do Scroll)
  const subLine = teamSection.querySelector('.subheading__line');
  const subText = teamSection.querySelector('.subheading__text');
  const img1 = teamSection.querySelector('.team__img.mod--1');
  const txtWrap = teamSection.querySelector('.team__txt-wrap');
  const advant = teamSection.querySelector('.team__advant');
  const advantTxtWraps = teamSection.querySelectorAll('.team__advant-txt-wrap');

  // Configuração inicial CSS inline para animação suave
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
  });

  // Função disparada ao revelar a dobra da equipe
  triggerRevealFn = () => {
    // 1. Anima a linha e o texto do subtítulo
    setTimeout(() => {
      if (subLine) subLine.style.width = "100%";
      if (subText) subText.style.width = "auto";
    }, 100);

    // 2. Revela a imagem principal com efeito de corte e zoom
    setTimeout(() => {
      if (img1) {
        img1.style.height = "100%";
        img1.style.transform = "scale(1)";
      }
    }, 300);

    // 3. Revela textos e bloco de estatísticas
    setTimeout(() => {
      if (txtWrap) txtWrap.style.opacity = "1";
      if (advant) advant.style.opacity = "1";

      advantTxtWraps.forEach((el, index) => {
        setTimeout(() => {
          el.style.transform = "translate3d(0, 0, 0)";
        }, index * 150);
      });
    }, 500);
  };

  // Botão fechar / voltar para a experiência 3D hero
  const closeBtn = document.getElementById('team-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('calloutClose', { detail: { id: 'equipe' } }));
    });
  }
}
