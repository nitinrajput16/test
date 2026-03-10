/* landing-3d.js
   Floating Three.js decorations for the landing page
*/
/* PortfolioScene — background 3D scene similar to the provided sample */
(function () {
    if (typeof THREE === 'undefined') {
        console.warn('Three.js is not loaded. Background 3D disabled.');
        return;
    }

    class PortfolioScene {
        constructor() {
            this.canvas = document.getElementById('bg-canvas');
            this.scene = new THREE.Scene();
            this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });

            this.clock = new THREE.Clock();
            this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
            this.scrollY = 0;
            this.particles = [];
            this.geometricShapes = [];
            this.floatingRings = [];
            this.nebulaClouds = [];

            this.init();
        }

        init() {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            this.renderer.setClearColor(0x000000, 0);

            this.camera.position.set(0, 0, 30);

            this.addLights();
            this.createParticleField();
            this.createFloatingGeometry();
            this.createNebulaClouds();
            this.createFloatingRings();
            this.createHeroOrb();
            this.createSkillsOrbit();

            window.addEventListener('resize', () => this.onResize());
            window.addEventListener('mousemove', (e) => this.onMouseMove(e));
            window.addEventListener('scroll', () => this.onScroll());

            this.animate();
        }

        addLights() {
            const ambientLight = new THREE.AmbientLight(0x6c5ce7, 0.3);
            this.scene.add(ambientLight);

            const pointLight1 = new THREE.PointLight(0x6c5ce7, 1.5, 100);
            pointLight1.position.set(10, 10, 10);
            this.scene.add(pointLight1);

            const pointLight2 = new THREE.PointLight(0x00cec9, 1, 100);
            pointLight2.position.set(-10, -10, 10);
            this.scene.add(pointLight2);

            const pointLight3 = new THREE.PointLight(0xfd79a8, 0.8, 100);
            pointLight3.position.set(0, 15, -10);
            this.scene.add(pointLight3);

            this.lights = [pointLight1, pointLight2, pointLight3];
        }

        createParticleField() {
            const count = 2000;
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(count * 3);
            const colors = new Float32Array(count * 3);
            const sizes = new Float32Array(count);

            const colorPalette = [
                new THREE.Color(0x6c5ce7),
                new THREE.Color(0xa29bfe),
                new THREE.Color(0x00cec9),
                new THREE.Color(0xfd79a8),
                new THREE.Color(0xffffff)
            ];

            for (let i = 0; i < count; i++) {
                const i3 = i * 3;
                positions[i3] = (Math.random() - 0.5) * 120;
                positions[i3 + 1] = (Math.random() - 0.5) * 120;
                positions[i3 + 2] = (Math.random() - 0.5) * 80;

                const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
                colors[i3] = color.r;
                colors[i3 + 1] = color.g;
                colors[i3 + 2] = color.b;

                sizes[i] = Math.random() * 0.6 + 0.4;
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

            const material = new THREE.PointsMaterial({
                size: 1.4,
                vertexColors: true,
                transparent: true,
                opacity: 0.8,
                blending: THREE.AdditiveBlending,
                sizeAttenuation: false
            });

            this.particleSystem = new THREE.Points(geometry, material);
            this.scene.add(this.particleSystem);
        }

        createFloatingGeometry() {
            const shapes = [
                { geo: new THREE.IcosahedronGeometry(1.2, 0), pos: [12, 8, -5], color: 0x6c5ce7, speed: 0.3 },
                { geo: new THREE.OctahedronGeometry(0.8, 0), pos: [-15, -5, -8], color: 0x00cec9, speed: 0.5 },
                { geo: new THREE.TetrahedronGeometry(1, 0), pos: [18, -8, -3], color: 0xfd79a8, speed: 0.4 },
                { geo: new THREE.DodecahedronGeometry(0.6, 0), pos: [-12, 12, -10], color: 0xa29bfe, speed: 0.35 },
                { geo: new THREE.IcosahedronGeometry(0.5, 0), pos: [8, -14, -6], color: 0xfdcb6e, speed: 0.45 },
                { geo: new THREE.OctahedronGeometry(1, 0), pos: [-20, 3, -12], color: 0x6c5ce7, speed: 0.25 },
                { geo: new THREE.TetrahedronGeometry(0.7, 0), pos: [22, 5, -15], color: 0x00cec9, speed: 0.55 }
            ];

            shapes.forEach((shape) => {
                const material = new THREE.MeshPhongMaterial({
                    color: shape.color,
                    transparent: true,
                    opacity: 0.15,
                    wireframe: true,
                    wireframeLinewidth: 1
                });
                const mesh = new THREE.Mesh(shape.geo, material);
                mesh.position.set(...shape.pos);
                mesh.userData = {
                    originalPos: [...shape.pos],
                    speed: shape.speed,
                    rotSpeed: {
                        x: (Math.random() - 0.5) * 0.02,
                        y: (Math.random() - 0.5) * 0.02,
                        z: (Math.random() - 0.5) * 0.01
                    }
                };
                this.geometricShapes.push(mesh);
                this.scene.add(mesh);
            });
        }

        createNebulaClouds() {
            const cloudData = [
                { pos: [25, 10, -30], scale: 8, color: 0x6c5ce7, opacity: 0.03 },
                { pos: [-20, -15, -25], scale: 12, color: 0x00cec9, opacity: 0.025 },
                { pos: [0, 20, -35], scale: 10, color: 0xfd79a8, opacity: 0.02 },
                { pos: [-30, 5, -20], scale: 6, color: 0xa29bfe, opacity: 0.035 }
            ];

            cloudData.forEach((cloud) => {
                const geo = new THREE.SphereGeometry(cloud.scale, 32, 32);
                const mat = new THREE.MeshBasicMaterial({ color: cloud.color, transparent: true, opacity: cloud.opacity, side: THREE.BackSide });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(...cloud.pos);
                this.nebulaClouds.push(mesh);
                this.scene.add(mesh);
            });
        }

        createFloatingRings() {
            const ringData = [
                { innerR: 3, outerR: 3.15, pos: [15, -3, -8], color: 0x6c5ce7 },
                { innerR: 2, outerR: 2.1, pos: [-18, 8, -12], color: 0x00cec9 },
                { innerR: 4, outerR: 4.1, pos: [5, 15, -18], color: 0xfd79a8 }
            ];

            ringData.forEach((ring, i) => {
                const geo = new THREE.RingGeometry(ring.innerR, ring.outerR, 64);
                const mat = new THREE.MeshBasicMaterial({ color: ring.color, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(...ring.pos);
                mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
                mesh.userData = { rotSpeed: 0.002 + i * 0.001 };
                this.floatingRings.push(mesh);
                this.scene.add(mesh);
            });
        }

        createHeroOrb() {
            const group = new THREE.Group();

            const coreGeo = new THREE.SphereGeometry(2.5, 64, 64);
            const coreMat = new THREE.MeshPhongMaterial({ color: 0x6c5ce7, emissive: 0x6c5ce7, emissiveIntensity: 0.3, transparent: true, opacity: 0.15, wireframe: true });
            const core = new THREE.Mesh(coreGeo, coreMat);
            group.add(core);

            const glowGeo = new THREE.SphereGeometry(3.2, 32, 32);
            const glowMat = new THREE.MeshBasicMaterial({ color: 0x6c5ce7, transparent: true, opacity: 0.04, side: THREE.BackSide });
            const glow = new THREE.Mesh(glowGeo, glowMat);
            group.add(glow);

            const innerGeo = new THREE.IcosahedronGeometry(1.8, 1);
            const innerMat = new THREE.MeshPhongMaterial({ color: 0x00cec9, emissive: 0x00cec9, emissiveIntensity: 0.2, transparent: true, opacity: 0.1, wireframe: true });
            const inner = new THREE.Mesh(innerGeo, innerMat);
            group.add(inner);

            const ring1Geo = new THREE.TorusGeometry(3.8, 0.03, 16, 100);
            const ring1Mat = new THREE.MeshBasicMaterial({ color: 0xa29bfe, transparent: true, opacity: 0.3 });
            const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
            ring1.rotation.x = Math.PI / 3;
            group.add(ring1);

            const ring2Geo = new THREE.TorusGeometry(4.5, 0.02, 16, 100);
            const ring2Mat = new THREE.MeshBasicMaterial({ color: 0x00cec9, transparent: true, opacity: 0.2 });
            const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
            ring2.rotation.x = -Math.PI / 4;
            ring2.rotation.y = Math.PI / 6;
            group.add(ring2);

            for (let i = 0; i < 8; i++) {
                const orbGeo = new THREE.SphereGeometry(0.08, 16, 16);
                const orbMat = new THREE.MeshBasicMaterial({ color: [0x6c5ce7, 0x00cec9, 0xfd79a8, 0xfdcb6e][i % 4], transparent: true, opacity: 0.8 });
                const orb = new THREE.Mesh(orbGeo, orbMat);
                const angle = (i / 8) * Math.PI * 2;
                const radius = 3.8 + (i % 2) * 0.7;
                orb.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.4, Math.sin(angle) * radius * 0.6);
                orb.userData = { angle, radius, speed: 0.3 + Math.random() * 0.2, heightFactor: 0.4 + Math.random() * 0.3 };
                group.add(orb);
                this.particles.push(orb);
            }

            group.position.set(10, 0, -5);
            this.heroOrb = group;
            this.heroOrbCore = core;
            this.heroOrbInner = inner;
            this.heroOrbRing1 = ring1;
            this.heroOrbRing2 = ring2;
            this.scene.add(group);
        }

        createSkillsOrbit() {
            const skills = ['React', 'Node.js', 'Three.js', 'TypeScript', 'Python', 'MongoDB', 'Docker', 'GraphQL', 'AWS', 'Vue.js', 'Next.js', 'PostgreSQL'];
            this.skillNodes = [];
            const group = new THREE.Group();

            skills.forEach((skill, i) => {
                const angle = (i / skills.length) * Math.PI * 2;
                const radius = 6;
                const nodeGeo = new THREE.SphereGeometry(0.25, 16, 16);
                const colors = [0x6c5ce7, 0x00cec9, 0xfd79a8, 0xfdcb6e, 0xa29bfe, 0x55efc4];
                const nodeMat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: 0.7 });
                const node = new THREE.Mesh(nodeGeo, nodeMat);
                node.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.3, Math.sin(angle) * radius * 0.5);
                node.userData = { angle, radius, speed: 0.15, name: skill };
                group.add(node);
                this.skillNodes.push(node);

                if (i > 0) {
                    const prevNode = this.skillNodes[i - 1];
                    const lineGeo = new THREE.BufferGeometry().setFromPoints([prevNode.position.clone(), node.position.clone()]);
                    const lineMat = new THREE.LineBasicMaterial({ color: 0x6c5ce7, transparent: true, opacity: 0.08 });
                    const line = new THREE.Line(lineGeo, lineMat);
                    group.add(line);
                }
            });

            const centerGeo = new THREE.IcosahedronGeometry(0.6, 1);
            const centerMat = new THREE.MeshPhongMaterial({ color: 0x6c5ce7, emissive: 0x6c5ce7, emissiveIntensity: 0.3, transparent: true, opacity: 0.3, wireframe: true });
            const center = new THREE.Mesh(centerGeo, centerMat);
            group.add(center);
            this.skillCenter = center;

            group.position.set(0, -50, -10);
            this.skillsGroup = group;
            this.scene.add(group);
        }

        animate() {
            requestAnimationFrame(() => this.animate());

            const elapsed = this.clock.getElapsedTime();
            const delta = this.clock.getDelta();

            this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.05;
            this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.05;

            if (this.particleSystem) {
                this.particleSystem.rotation.y = elapsed * 0.02;
                this.particleSystem.rotation.x = Math.sin(elapsed * 0.01) * 0.1;
            }

            this.geometricShapes.forEach((shape) => {
                const ud = shape.userData;
                shape.rotation.x += ud.rotSpeed.x;
                shape.rotation.y += ud.rotSpeed.y;
                shape.rotation.z += ud.rotSpeed.z;

                shape.position.y = ud.originalPos[1] + Math.sin(elapsed * ud.speed) * 1.5;
                shape.position.x = ud.originalPos[0] + Math.cos(elapsed * ud.speed * 0.7) * 0.5;
            });

            this.floatingRings.forEach((ring) => {
                ring.rotation.z += ring.userData.rotSpeed;
                ring.rotation.x += ring.userData.rotSpeed * 0.5;
            });

            this.nebulaClouds.forEach((cloud, i) => {
                cloud.scale.setScalar(1 + Math.sin(elapsed * 0.2 + i) * 0.1);
            });

            if (this.heroOrb) {
                this.heroOrbCore.rotation.y = elapsed * 0.2;
                this.heroOrbCore.rotation.x = elapsed * 0.1;
                this.heroOrbInner.rotation.y = -elapsed * 0.3;
                this.heroOrbInner.rotation.x = elapsed * 0.15;
                this.heroOrbRing1.rotation.z = elapsed * 0.4;
                this.heroOrbRing2.rotation.z = -elapsed * 0.3;

                this.particles.forEach((p) => {
                    const ud = p.userData;
                    ud.angle += 0.005 * ud.speed;
                    p.position.x = Math.cos(ud.angle) * ud.radius;
                    p.position.y = Math.sin(ud.angle) * ud.radius * ud.heightFactor;
                    p.position.z = Math.sin(ud.angle) * ud.radius * 0.6;
                });

                this.heroOrb.position.x = 10 + this.mouse.x * 2;
                this.heroOrb.position.y = this.mouse.y * 2;

                const scrollFactor = this.scrollY / window.innerHeight;
                this.heroOrb.position.y -= scrollFactor * 10;
                this.heroOrb.rotation.y = scrollFactor * 0.5;
            }

            if (this.skillsGroup) {
                this.skillCenter.rotation.y = elapsed * 0.5;
                this.skillCenter.rotation.x = elapsed * 0.25;

                this.skillNodes.forEach((node) => {
                    const ud = node.userData;
                    ud.angle += 0.003 * ud.speed;
                    node.position.x = Math.cos(ud.angle) * ud.radius;
                    node.position.y = Math.sin(ud.angle) * ud.radius * 0.3;
                    node.position.z = Math.sin(ud.angle) * ud.radius * 0.5;
                });
            }

            this.camera.position.x += (this.mouse.x * 1.5 - this.camera.position.x) * 0.02;
            this.camera.position.y += (this.mouse.y * 1.5 - this.camera.position.y) * 0.02;
            this.camera.lookAt(0, 0, 0);

            this.lights[0].position.x = Math.sin(elapsed * 0.3) * 15;
            this.lights[0].position.y = Math.cos(elapsed * 0.2) * 15;
            this.lights[1].position.x = Math.cos(elapsed * 0.25) * 15;
            this.lights[1].position.z = Math.sin(elapsed * 0.35) * 15;

            this.renderer.render(this.scene, this.camera);
        }

        onResize() {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        }

        onMouseMove(e) {
            this.mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
            this.mouse.targetY = -(e.clientY / window.innerHeight - 0.5) * 2;
        }

        onScroll() {
            this.scrollY = window.scrollY;
        }
    }

    let portfolioScene;
    document.addEventListener('DOMContentLoaded', () => {
        portfolioScene = new PortfolioScene();
    });

})();
