import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// All architecture and the car are modeled locally; no remote model assets.
export function createCity(mobile) {
 const scene=new THREE.Scene();scene.background=new THREE.Color('#0b1220');scene.fog=new THREE.Fog('#0b1220',145,270);
 const camera=new THREE.PerspectiveCamera(42,1,.1,400);
 const ambient=new THREE.HemisphereLight('#f4f2ea','#334a68',2.5);scene.add(ambient);
 const sun=new THREE.DirectionalLight('#f4f2ea',2.8);sun.position.set(-25,65,35);sun.castShadow=!mobile;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-85,right:85,top:70,bottom:-70,near:1,far:180});sun.shadow.normalBias=.06;scene.add(sun);
 const rim=new THREE.DirectionalLight('#7dd3fc',1.5);rim.position.set(45,30,-50);scene.add(rim);
 const materials=new Map();
 const mat=(color,metalness=0,roughness=.7)=>{const key=color+metalness+roughness;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,metalness,roughness}));return materials.get(key);};
 const glass=new THREE.MeshStandardMaterial({color:'#142c43',metalness:.45,roughness:.18});
 const warmGlass=new THREE.MeshStandardMaterial({color:'#c0e8ff',emissive:'#477ac5',emissiveIntensity:0,roughness:.35});
 const boxGeo=new THREE.BoxGeometry(1,1,1);const roundedWall=new RoundedBoxGeometry(1,1,1,2,.045);
 const batches=new Map();
 function box(x,y,z,w,h,d,material,rotation=0){if(!batches.has(material))batches.set(material,[]);batches.get(material).push({x,y,z,w,h,d,rotation});}
 function mesh(geometry,material,x,y,z,parent=scene){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 let seed=72;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
 const colors=['#d7e0e5','#92a9c0','#b9cbd9','#7597be','#5b8cff'];
 const roadZ=x=>Math.sin(x*.09)*10+Math.cos(x*.19)*3;
 const points=[];for(let x=-65;x<=65;x+=2)points.push(new THREE.Vector3(x,1.1,roadZ(x)));
 const route=new THREE.CatmullRomCurve3(points);
 box(0,-3.5,0,149,4, 70,mat('#23374c'));



 // A continuous park base surrounds the road; stepped hills frame the city.
 box(0,-.7,0,146,1.5,64,mat('#697d84'));
 // Fine site-plan construction lines, independent of the road and facade batches.
 const gridPoints=[];
 for(let x=-72;x<=72;x+=6)gridPoints.push(x,.08,-32,x,.08,32);
 for(let z=-30;z<=30;z+=6)gridPoints.push(-73,.08,z,73,.08,z);
 const gridGeometry=new THREE.BufferGeometry();gridGeometry.setAttribute('position',new THREE.Float32BufferAttribute(gridPoints,3));
 scene.add(new THREE.LineSegments(gridGeometry,new THREE.LineBasicMaterial({color:'#7dd3fc',transparent:true,opacity:.18,depthWrite:false})));
 for(let i=0;i<(mobile?15:21);i++){const x=-66+i*(mobile?9:6.6);for(const side of [-1,1]){const z=side*(26+random()*3);const zone=Math.min(4,Math.floor((x+68)/28));building(x,z,3.3+random(),3.5,4+random()*7,zone,i%3);}}
 const positions=[],indices=[];
 for(let i=0;i<=480;i++){const t=i/480,p=route.getPointAt(t),v=route.getTangentAt(t),n=new THREE.Vector3(-v.z,0,v.x);for(const side of [-1,1]){const q=p.clone().addScaledVector(n,side*2.65);positions.push(q.x,q.y,q.z);}if(i<480){const j=i*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);}}
 const roadGeo=new THREE.BufferGeometry();roadGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));roadGeo.setIndex(indices);roadGeo.computeVertexNormals();const asphalt=mat('#34414a');asphalt.side=THREE.DoubleSide;const roadMesh=new THREE.Mesh(roadGeo,asphalt);roadMesh.receiveShadow=true;scene.add(roadMesh);
 for(const side of [-1,1]){const line=[];for(let i=0;i<=180;i++){const t=i/180,p=route.getPointAt(t),v=route.getTangentAt(t);p.addScaledVector(new THREE.Vector3(-v.z,0,v.x),side*2.7);p.y+=.12;line.push(p);}scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(line),240,.12,5,false),mat('#b8d2eb')));}
 for(let t=.015;t<1;t+=.015){const p=route.getPointAt(t),v=route.getTangentAt(t);box(p.x,p.y+.025,p.z,.85,.035,.1,mat('#d9e9f4'),-Math.atan2(v.z,v.x));}
 for(let t=.04;t<1;t+=.08){const p=route.getPointAt(t);for(const side of [-1,1]){box(p.x,-.2,p.z+side*2.25,.4,2.5,.4,mat('#a5b6b9'));}}
 function building(x,z,width,depth,height,index,type){
  const stone=mat(colors[index]);const trim=mat('#f4f2ea');const concrete=mat('#9bb0bd');
  box(x,.15,z,width+1.8,.6,depth+1.8,mat('#bdcad0'));
  const wall=mesh(roundedWall,stone,x,height/2+.45,z);wall.scale.set(width,height,depth);
  // Plinth, roof slab, front entrance and roof equipment.
  box(x,.75,z,width+.15,.6,depth+.15,concrete);
  box(x,height+.5,z,width+.3,.26,depth+.3,trim);for(const side of [-1,1]){box(x,height+.8,z+side*depth/2,width,.55,.09,trim);box(x+side*width/2,height+.8,z,.09,.55,depth,trim);}
  box(x+.6,height+.9,z-.5,width*.25,.65,depth*.2,mat('#697d84'));
  box(x,1.25,z+depth/2+.04,.8,1.65,.09,glass);
  box(x,2.3,z+depth/2+.45,1.8,.12,1.05,trim);for(let step=0;step<3;step++)box(x,.15+step*.1,z+depth/2+1-step*.22,1.3,.1,.65,concrete);
  const floors=Math.floor((height-1.6)/1.25),columns=Math.max(2,Math.floor(width/.95));
  for(let f=0;f<floors;f++){const y=2.35+f*1.25;for(let c=0;c<columns;c++){const wx=x-width/2+(c+.5)*width/columns;const windowMat=random()>.83?warmGlass:glass;for(const side of [-1,1])box(wx,y,z+side*(depth/2+.04),width/columns*.59,.78,.075,windowMat);}
   for(let c=0;c<Math.max(2,Math.floor(depth));c++){const wz=z-depth/2+(c+.5)*depth/Math.max(2,Math.floor(depth));for(const side of [-1,1])box(x+side*(width/2+.035),y,wz,.075,.78,.55,glass);}
   if(type===1){box(x,y-.55,z+depth/2+.3,width,.1,.7,trim);box(x,y-.28,z+depth/2+.6,width,.45,.055,glass);for(const side of [-1,1])box(x+side*width/2,y-.28,z+depth/2+.3,.055,.45,.6,trim);}
   if(type===2){box(x,y-.6,z,width+.08,.07,depth+.08,trim);for(const side of [-1,1])for(let c=0;c<=columns;c++)box(x-width/2+c*width/columns,y,z+side*(depth/2+.1),.055,1.25,.055,trim);}
  }
  if(type===2 && height>8){const setback=mesh(roundedWall,glass,x,height+1.3,z);setback.scale.set(width*.7,1.35,depth*.7);box(x,height+2,z,width*.76,.13,depth*.76,trim);box(x+.4,height+2.6,z,.08,1.3,.08,concrete);}
  if(type===0){ // A sloped townhouse roof with chimney.
   const triangle=new THREE.Shape();triangle.moveTo(-width/2-.2,0);triangle.lineTo(0,1.45);triangle.lineTo(width/2+.2,0);triangle.closePath();const roof=new THREE.ExtrudeGeometry(triangle,{depth:depth+.4,bevelEnabled:false});mesh(roof,mat('#445767'),x,height+.45,z-depth/2-.2);
   box(x+width*.24,height+1.3,z-.4,.45,1.3,.5,trim);
  }
 }
 function roundTower(x,z,zone){
  const radius=2.1,height=12;const trim=mat('#cad5cf');
  mesh(new THREE.CylinderGeometry(radius+1,radius+1,.45,24),mat('#bdcad0'),x,.23,z);
  mesh(new THREE.CylinderGeometry(radius,radius,height,24),glass,x,height/2+.45,z);
  for(let floor=0;floor<9;floor++){const y=1.7+floor*1.2;mesh(new THREE.CylinderGeometry(radius+.08,radius+.08,.1,24),trim,x,y-.5,z);for(let j=0;j<16;j++){const a=j*Math.PI*2/16;box(x+Math.cos(a)*(radius+.025),y,z+Math.sin(a)*(radius+.025),.045,1.14,.065,trim,-a);}}
  mesh(new THREE.CylinderGeometry(radius+.15,radius+.15,.28,24),mat(colors[zone]),x,height+.6,z);
  mesh(new THREE.CylinderGeometry(radius*.65,radius*.8,1.6,24),glass,x,height+1.45,z);
  mesh(new THREE.ConeGeometry(radius*.68,1.1,24),trim,x,height+2.7,z);
 }
 // Lower residential facades in the foreground, offices and apartments behind.
 for(let i=0;i<19;i++){const x=-61+i*6.7;const zone=Math.min(4,Math.floor((x+68)/28));const z=roadZ(x);const rear=z-11-random()*3,front=z+10+random()*3;
  if(i%6===2)roundTower(x,rear,zone);else building(x,rear,3.5+random()*1.3,3.2+random(),6+random()*9,zone,i%3===0?1:2);
  if(i%2===0)building(x+1,front,3.5,3,3.7+random()*2,zone,0);
 }
 // Civic buildings at the three story landmarks.
 const stations=[.23,.54,.84];
 stations.forEach((t,i)=>{const p=route.getPointAt(t),x=p.x,z=p.z-7;
  box(x,.28,z,7,.6,6,mat('#a1bfd5'));
  const marker=new THREE.Mesh(new THREE.TorusGeometry(4.5,.035,4,mobile?24:48),new THREE.MeshBasicMaterial({color:'#7dd3fc',transparent:true,opacity:.65}));marker.rotation.x=Math.PI/2;marker.position.set(x,.65,z);scene.add(marker);
  if(i===0){building(x,z,4,3,5.5,0,1);box(x,6.35,z,3,.3,2,mat('#5b8cff'));}
  if(i===1){building(x,z,4.7,3.5,8,2,2);const dome=mesh(new THREE.SphereGeometry(1.7,20,12,0,Math.PI*2,0,Math.PI/2),glass,x,8.7,z);dome.scale.y=.7;}
  if(i===2){building(x,z,4,3.5,11,4,2);box(x,13,z,.12,3,.12,mat('#cbdce0'));}
 });
 const trunk=mat('#766556'),leaf=mat('#78999c');
 for(let i=0;i<(mobile?28:54);i++){const x=-64+random()*130,z=roadZ(x)+(random()>.5?1:-1)*(5+random()*2.5);box(x,1.1,z,.22,1.6,.22,trunk);mesh(new THREE.IcosahedronGeometry(.8+random()*.35,1),leaf,x,2.25,z);}
 const lightPools=[];const streetLights=[];const poolMaterial=new THREE.MeshBasicMaterial({color:'#ffce87',transparent:true,opacity:0,depthWrite:false});
 const pole=mat('#5c7079');const lamp=new THREE.MeshStandardMaterial({color:'#fff0ca',emissive:'#ffdda0',emissiveIntensity:0});
 for(let t=.045;t<1;t+=.05){const p=route.getPointAt(t),v=route.getTangentAt(t),n=new THREE.Vector3(-v.z,0,v.x);p.addScaledVector(n,3.5);box(p.x,2.5,p.z,.11,3.7,.11,pole);box(p.x,4.3,p.z-.35,.12,.12,.8,pole);box(p.x,4.22,p.z-.7,.45,.12,.3,lamp);const pool=mesh(new THREE.CircleGeometry(2.5,mobile?16:32),poolMaterial,p.x,1.16,p.z-.7);pool.rotation.x=-Math.PI/2;pool.castShadow=false;lightPools.push(pool);if(!mobile&&streetLights.length<4&&Math.round(t*100)%2===1){const light=new THREE.PointLight('#ffce87',0,13,2);light.position.set(p.x,4.1,p.z-.7);scene.add(light);streetLights.push(light);}}
 // Instance all recurring walls, windows, curbs and fixtures by material.
 const dummy=new THREE.Object3D();for(const [material,items]of batches){const instanced=new THREE.InstancedMesh(boxGeo,material,items.length);items.forEach((b,i)=>{dummy.position.set(b.x,b.y,b.z);dummy.scale.set(b.w,b.h,b.d);dummy.rotation.set(0,b.rotation,0);dummy.updateMatrix();instanced.setMatrixAt(i,dummy.matrix);});instanced.castShadow=true;instanced.receiveShadow=true;scene.add(instanced);}
 const traveler=new THREE.Group();const wheels=[];
 const paint=new THREE.MeshPhysicalMaterial({color:'#5b8cff',metalness:.42,roughness:.28,clearcoat:1});
 const rubber=mat('#172126'),alloy=mat('#c5d1d5',.75,.23);
 const carGeometry=new RoundedBoxGeometry(1,1,1,2,.06);const carBox=(x,y,z,w,h,d,m)=>{const o=mesh(carGeometry,m,x,y,z,traveler);o.scale.set(w,h,d);return o;};
 carBox(0,.6,0,2.8,.45,1.28,paint);carBox(-.2,.97,0,1.45,.52,1.16,glass);carBox(-.2,1.26,0,1.5,.09,1.2,paint);carBox(.86,.85,0,.85,.12,1.24,paint);carBox(-1.12,.84,0,.45,.16,1.24,paint);
 for(const z of [-.605,.605]){carBox(-.2,1,z,.055,.49,.05,paint);carBox(-.8,1,z,.075,.48,.06,paint);carBox(.48,1,z,.075,.48,.06,paint);carBox(.2,.66,z,.19,.04,.04,alloy);carBox(.45,.99,z*1.15,.18,.08,.15,paint);}
 carBox(1.43,.57,0,.08,.16,1.23,alloy);carBox(-1.43,.57,0,.08,.16,1.23,rubber);carBox(1.48,.7,0,.05,.17,.56,rubber);
 const headlamp=new THREE.MeshStandardMaterial({color:'#fff4de',emissive:'#ffe4ac',emissiveIntensity:0});const taillamp=new THREE.MeshStandardMaterial({color:'#8b2639',emissive:'#ff263f',emissiveIntensity:0});
 for(const z of [-.43,.43]){carBox(1.45,.79,z,.06,.18,.28,headlamp);carBox(-1.45,.78,z,.06,.16,.28,taillamp);}
 for(const x of [-.93,.91])for(const z of [-.67,.67]){const wheel=new THREE.Group();wheel.position.set(x,.35,z);const tire=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.2,20),rubber);tire.rotation.x=Math.PI/2;wheel.add(tire);const hub=new THREE.Mesh(new THREE.CylinderGeometry(.21,.21,.215,12),alloy);hub.rotation.x=Math.PI/2;wheel.add(hub);traveler.add(wheel);wheels.push(wheel);}
 const headlights=[];
 for(const z of [-.43,.43]){const light=new THREE.SpotLight('#ffe8bd',0,23,.35,.65,1.5);light.position.set(1.5,.8,z);light.target.position.set(13,.05,z);traveler.add(light,light.target);headlights.push(light);}
 // Soft road washes supplement the two real headlights without extra lights or shadows.
 const beamMaterial=new THREE.MeshBasicMaterial({color:'#ffe4aa',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
 const beamShape=new THREE.Shape();beamShape.moveTo(1.5,-.45);beamShape.lineTo(13,-2);beamShape.quadraticCurveTo(15,0,13,2);beamShape.lineTo(1.5,.45);
 const beam=new THREE.Mesh(new THREE.ShapeGeometry(beamShape),beamMaterial);beam.rotation.x=-Math.PI/2;beam.position.y=.08;traveler.add(beam);
 const daySky=new THREE.Color('#0b1220'),nightSky=new THREE.Color('#020610');
 function setNight(amount){const n=THREE.MathUtils.clamp(amount,0,1);scene.background.copy(daySky).lerp(nightSky,n);scene.fog.color.copy(scene.background);ambient.intensity=THREE.MathUtils.lerp(2.5,.38,n);sun.intensity=THREE.MathUtils.lerp(2.8,.16,n);rim.intensity=THREE.MathUtils.lerp(1.5,.62,n);warmGlass.emissiveIntensity=n*2.8;lamp.emissiveIntensity=n*5;headlamp.emissiveIntensity=n*7;taillamp.emissiveIntensity=n*4;poolMaterial.opacity=n*.15;beamMaterial.opacity=n*.13;streetLights.forEach(light=>light.intensity=n*24);headlights.forEach(light=>light.intensity=n*32);}
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(3.3,1.6),new THREE.MeshBasicMaterial({color:'#101b20',transparent:true,opacity:.25,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.03;traveler.add(shadow);scene.add(traveler);
 return {scene,camera,route,traveler,wheels,setNight};
}


