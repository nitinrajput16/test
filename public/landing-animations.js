// GSAP Animations for Landing Page
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

// Page Load Animations
window.addEventListener('DOMContentLoaded', () => {
    // Navbar animation
    gsap.from('.navbar', {
        y: -100,
        opacity: 0,
        duration: 1,
        ease: 'power3.out'
    });

    // Hero section animations
    const heroTimeline = gsap.timeline({ defaults: { ease: 'power3.out' } });

    heroTimeline
        .from('.hero-badge', {
            scale: 0,
            opacity: 0,
            duration: 0.6,
            delay: 0.3
        })
        .from('.hero-title', {
            y: 50,
            opacity: 0,
            duration: 0.8
        }, '-=0.2')
        .from('.hero-description', {
            y: 30,
            opacity: 0,
            duration: 0.8
        }, '-=0.4')
        .from('.btn-hero', {
            scale: 0.8,
            opacity: 0,
            duration: 0.6,
            stagger: 0.2
        }, '-=0.4');

        // Hero gradient-text typing animation
        (function () {
            const typeTarget = document.querySelector('.hero-title .gradient-text');
            if (!typeTarget) return;

            const words = ['Together', 'Collectively', 'At once', 'In sync', 'As a Team', 'With all'];
            let w = 0, i = 0, deleting = false;

            const typeSpeed = 100;
            const deleteSpeed = 60;
            const holdDelay = 1200;
            const betweenDelay = 400;

            function tick() {
                const word = words[w];
                if (!deleting) {
                    i++;
                    typeTarget.textContent = word.slice(0, i);
                    if (i === word.length) {
                        deleting = true;
                        setTimeout(tick, holdDelay);
                        return;
                    }
                    setTimeout(tick, typeSpeed);
                } else {
                    i--;
                    typeTarget.textContent = word.slice(0, i);
                    if (i === 0) {
                        deleting = false;
                        w = (w + 1) % words.length;
                        setTimeout(tick, betweenDelay);
                        return;
                    }
                    setTimeout(tick, deleteSpeed);
                }
            }

            typeTarget.textContent = '';
            tick();
        })();
    document.querySelector(".btn-teacher").addEventListener("click", (e) => {
  e.preventDefault(); // Prevent default anchor jump
  gsap.to(window, {
    duration: 1,
    scrollTo: "#features",
    ease: "power2.inOut"
  });
});

    // Gradient text animation
    gsap.to('.gradient-text', {
        backgroundPosition: '200% center',
        ease: 'none',
        duration: 3,
        repeat: -1,
        yoyo: true
    });

    // Feature cards scroll animation
    gsap.utils.toArray('.feature-card').forEach((card, index) => {
        gsap.from(card, {
            scrollTrigger: {
                trigger: card,
                start: 'top 80%',
                end: 'bottom 20%',
                toggleActions: 'play none none reverse'
            },
            y: 80,
            opacity: 0,
            duration: 0.8,
            delay: index * 0.1,
            ease: 'power3.out'
        });

        // Add hover animation
        card.addEventListener('mouseenter', () => {
            gsap.to(card, {
                scale: 1.05,
                duration: 0.3,
                ease: 'power2.out'
            });
        });

        card.addEventListener('mouseleave', () => {
            gsap.to(card, {
                scale: 1,
                duration: 0.3,
                ease: 'power2.out'
            });
        });
    });

    // About section animation
    gsap.from('.about-text', {
        scrollTrigger: {
            trigger: '.about',
            start: 'top 70%',
            toggleActions: 'play none none reverse'
        },
        x: -100,
        opacity: 0,
        duration: 1,
        ease: 'power3.out'
    });

    gsap.from('.about-image', {
        scrollTrigger: {
            trigger: '.about',
            start: 'top 70%',
            toggleActions: 'play none none reverse'
        },
        x: 100,
        opacity: 0,
        duration: 1,
        ease: 'power3.out'
    });

    // About list items animation
    gsap.utils.toArray('.about-list li').forEach((item, index) => {
        gsap.from(item, {
            scrollTrigger: {
                trigger: '.about-list',
                start: 'top 80%',
                toggleActions: 'play none none reverse'
            },
            x: -50,
            opacity: 0,
            duration: 0.6,
            delay: index * 0.1,
            ease: 'power3.out'
        });
    });

    // Code preview animation
    gsap.from('.code-preview', {
        scrollTrigger: {
            trigger: '.code-preview',
            start: 'top 80%',
            toggleActions: 'play none none reverse'
        },
        scale: 0.9,
        opacity: 0,
        duration: 1,
        ease: 'back.out(1.7)'
    });

    // Supported languages marquee entrance (badges are continuously moving)
    gsap.from('.languages-marquee', {
        scrollTrigger: {
            trigger: '.languages',
            start: 'top 80%',
            toggleActions: 'play none none reverse'
        },
        y: 24,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out'
    });

    // CTA section animation
    gsap.from('.cta-title', {
        scrollTrigger: {
            trigger: '.cta',
            start: 'top 80%',
            toggleActions: 'play none none reverse'
        },
        scale: 0.8,
        opacity: 0,
        duration: 0.8,
        ease: 'back.out(1.7)'
    });

    gsap.from('.cta-description', {
        scrollTrigger: {
            trigger: '.cta',
            start: 'top 80%',
            toggleActions: 'play none none reverse'
        },
        y: 30,
        opacity: 0,
        duration: 0.8,
        delay: 0.2,
        ease: 'power3.out'
    });

    gsap.from('.btn-cta', {
        scrollTrigger: {
            trigger: '.cta',
            start: 'top 80%',
            toggleActions: 'play none none reverse'
        },
        scale: 0,
        opacity: 0,
        duration: 0.6,
        delay: 0.4,
        ease: 'back.out(1.7)'
    });

    // Button hover effects
    document.querySelectorAll('.btn-hero, .btn-cta, .btn-primary').forEach(button => {
        button.addEventListener('mouseenter', () => {
            gsap.to(button, {
                scale: 1.05,
                boxShadow: '0 15px 40px rgba(0, 170, 85, 0.4)',
                duration: 0.3,
                ease: 'power2.out'
            });
        });

        button.addEventListener('mouseleave', () => {
            gsap.to(button, {
                scale: 1,
                boxShadow: '0 0 0 rgba(0, 170, 85, 0)',
                duration: 0.3,
                ease: 'power2.out'
            });
        });
    });

    // Smooth scroll for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                gsap.to(window, {
                    duration: 1,
                    scrollTo: {
                        y: target,
                        offsetY: 80
                    },
                    ease: 'power3.inOut'
                });
            }
        });
    });

    // Parallax effect for hero section (no opacity change)
    gsap.to('.hero-title', {
        scrollTrigger: {
            trigger: '.hero',
            start: 'top top',
            end: 'bottom top',
            scrub: 1
        },
        y: 50,
        ease: 'none'
    });

    gsap.to('.hero-description', {
        scrollTrigger: {
            trigger: '.hero',
            start: 'top top',
            end: 'bottom top',
            scrub: 1
        },
        y: 80,
        ease: 'none'
    });

    // Footer animation
    gsap.from('.footer-content > *', {
        scrollTrigger: {
            trigger: '.footer',
            start: 'top 90%',
            toggleActions: 'play none none reverse'
        },
        y: 50,
        opacity: 0,
        duration: 0.8,
        stagger: 0.2,
        ease: 'power3.out'
    });

    // Floating animation for feature icons
    gsap.utils.toArray('.feature-icon').forEach((icon) => {
        gsap.to(icon, {
            y: -10,
            duration: 2,
            repeat: -1,
            yoyo: true,
            ease: 'power1.inOut'
        });
    });

    // Section title animations
    gsap.utils.toArray('.section-title').forEach((title) => {
        gsap.from(title, {
            scrollTrigger: {
                trigger: title,
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            },
            scale: 0.8,
            opacity: 0,
            duration: 0.8,
            ease: 'back.out(1.7)'
        });
    });

    // Code preview typing effect
    const codeText = document.querySelector('.code-body code');
    if (codeText) {
        const originalText = codeText.innerHTML;
        codeText.innerHTML = '';

        ScrollTrigger.create({
            trigger: '.code-preview',
            start: 'top 70%',
            onEnter: () => {
                let i = 0;
                const typeInterval = setInterval(() => {
                    if (i < originalText.length) {
                        codeText.innerHTML = originalText.substring(0, i + 1) + '<span style="color: #0a5; animation: blink 0.7s infinite;">|</span>';
                        i++;
                    } else {
                        codeText.innerHTML = originalText;
                        clearInterval(typeInterval);
                    }
                }, 20);
            },
            once: true
        });
    }

    // Navbar scroll effect
    ScrollTrigger.create({
        start: 'top -80',
        end: 99999,
        toggleClass: { className: 'scrolled', targets: '.navbar' }
    });

    // Add cursor trail effect
    const cursor = document.createElement('div');
    cursor.className = 'cursor-trail';
    document.body.appendChild(cursor);

    document.addEventListener('mousemove', (e) => {
        gsap.to(cursor, {
            x: e.clientX,
            y: e.clientY,
            duration: 0.5,
            ease: 'power2.out'
        });
    });

    // Hide cursor trail on interactive elements
    document.querySelectorAll('a, button, .feature-card, .language-badge').forEach(element => {
        element.addEventListener('mouseenter', () => {
            gsap.to(cursor, { scale: 2, duration: 0.3 });
        });
        element.addEventListener('mouseleave', () => {
            gsap.to(cursor, { scale: 1, duration: 0.3 });
        });
    });
});

// Add loading screen animation
window.addEventListener('load', () => {
    gsap.to('body', {
        opacity: 1,
        duration: 0.5
    });
});
