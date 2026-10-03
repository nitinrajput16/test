/* =========================================================================
   THREE.JS: Isometric 3D Voxel Pixel Server Grid in Hero Background
   ========================================================================= */
(function initThreeVoxelCanvas() {
  const canvas = document.getElementById('threejs-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const scene = new THREE.Scene();
  
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
  camera.position.set(30, 26, 30);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  // Ambient & Directional Lights
  const ambientLight = new THREE.AmbientLight(0x404870, 2.2);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0x00ffcc, 2.5);
  dirLight.position.set(20, 40, 20);
  scene.add(dirLight);

  const pinkLight = new THREE.PointLight(0xff3377, 3, 50);
  pinkLight.position.set(-15, 10, -15);
  scene.add(pinkLight);

  // Voxel Grid Generation
  const group = new THREE.Group();
  const cubeGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
  
  // Retro Palette Materials
  const materials = [
    new THREE.MeshLambertMaterial({ color: 0x181a2f }),
    new THREE.MeshLambertMaterial({ color: 0x242a4d }),
    new THREE.MeshLambertMaterial({ color: 0x00ffcc }),
    new THREE.MeshLambertMaterial({ color: 0xff3377 })
  ];

  const towers = [];
  const gridSize = 9;
  const spacing = 3.2;

  for (let x = -gridSize; x <= gridSize; x += 2) {
    for (let z = -gridSize; z <= gridSize; z += 2) {
      const height = Math.floor(Math.random() * 5) + 1;
      for (let y = 0; y < height; y++) {
        const isTip = y === height - 1;
        const mat = isTip && Math.random() > 0.6 
          ? (Math.random() > 0.5 ? materials[2] : materials[3]) 
          : materials[y % 2];
          
        const mesh = new THREE.Mesh(cubeGeo, mat);
        mesh.position.set(x * (spacing / 2), y * 1.5 - 5, z * (spacing / 2));
        group.add(mesh);
        towers.push({ mesh, baseY: mesh.position.y, offset: Math.random() * 10 });
      }
    }
  }
  scene.add(group);

  // Animation Loop
  let clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    
    group.rotation.y = time * 0.08;
    
    towers.forEach(t => {
      t.mesh.position.y = t.baseY + Math.sin(time * 2 + t.offset) * 0.25;
    });

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    if (!canvas) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();
