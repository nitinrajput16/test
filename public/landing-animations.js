/* =========================================================================
   GSAP & ANIME.JS: Landing Page Marquee, Scroll Reveals & Interactive Editor
   ========================================================================= */
document.addEventListener('DOMContentLoaded', () => {
  // 1. GSAP Scroll & Marquee Animations
  if (typeof gsap !== 'undefined') {
    if (typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);

      // Feature cards staggered reveal
      gsap.from(".feature-card", {
        scrollTrigger: {
          trigger: ".cards-grid",
          start: "top 85%"
        },
        scale: 0.9,
        opacity: 0,
        y: 40,
        stagger: 0.12,
        duration: 0.6,
        ease: "back.out(1.5)"
      });
    }

    // Infinite Marquee Track Loop
    const marqueeTrack = document.getElementById('marquee-track');
    if (marqueeTrack) {
      gsap.to("#marquee-track", {
        xPercent: -50,
        ease: "none",
        duration: 20,
        repeat: -1
      });
    }

    // Hero Entry Animation
    gsap.from(".hero-content > *", {
      opacity: 0,
      y: 30,
      stagger: 0.15,
      duration: 0.8,
      ease: "steps(6)"
    });
  }

  // 2. ANIME.JS: Interactive Code Sandbox Dynamic Typing FX & Terminal Trigger
  if (typeof anime !== 'undefined') {
    const codePhrases = ['"synced"', '"collaborative"', '"gemini-active"', '"evaluating"'];
    let phraseIdx = 0;
    const dynamicTypingEl = document.getElementById('dynamic-typing');

    if (dynamicTypingEl) {
      setInterval(() => {
        phraseIdx = (phraseIdx + 1) % codePhrases.length;
        anime({
          targets: dynamicTypingEl,
          opacity: [1, 0],
          duration: 250,
          easing: 'linear',
          complete: () => {
            dynamicTypingEl.textContent = codePhrases[phraseIdx];
            anime({
              targets: dynamicTypingEl,
              opacity: [0, 1],
              duration: 250,
              easing: 'linear'
            });
          }
        });
      }, 2800);
    }

    // Run Code Button Interactive Trigger
    const runBtn = document.getElementById('run-trigger');
    const termOutput = document.getElementById('term-output');

    if (runBtn && termOutput) {
      runBtn.addEventListener('click', () => {
        anime({
          targets: runBtn,
          scale: [1, 0.94, 1],
          duration: 150,
          easing: 'easeInOutQuad'
        });

        termOutput.innerHTML = `> [Judge0]: Dispatching code...<br>> CPU: 12ms | Memory: 8.2MB<br>> <span style="color:#00ffcc;">✓ 0 errors. Real-time state synchronized!</span>`;

        anime({
          targets: termOutput,
          backgroundColor: ['rgba(0, 255, 204, 0.25)', 'transparent'],
          duration: 600,
          easing: 'easeOutQuad'
        });
      });
    }
  }
});
