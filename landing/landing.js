import { createCity } from './city.js';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { animate } from 'animejs';
gsap.registerPlugin(ScrollTrigger);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 600px)').matches;
const cards = [...document.querySelectorAll('.feature-card')];
const chapters = [...document.querySelectorAll('[data-chapter]')];
const canvas = document.querySelector('#world');
const state = { progress: 0 };
let renderer, scene, camera, route, traveler, trigger, frame, resizeObserver;
let active = -1;
const clamp = THREE.MathUtils.clamp;
let wheels=[];
function buildWorld(){({scene,camera,route,traveler,wheels}=createCity(mobile));}
function updateCamera(p){
  const t=clamp((p-.08)/.9,0,1), point=route.getPointAt(.07+t*.86);
  const overview=new THREE.Vector3(-3,75,103);const journey=new THREE.Vector3(point.x+20,mobile?43:39,point.z+(mobile?52:49));
  const blend=gsap.parseEase('power2.inOut')(clamp(p/.21,0,1));camera.position.copy(overview).lerp(journey,blend);
  const look=new THREE.Vector3(point.x+(mobile?0:7),1,point.z+(mobile?12:-1));look.lerp(new THREE.Vector3(0,0,0),1-blend);camera.lookAt(look);
  traveler.position.copy(point);wheels.forEach(wheel=>wheel.rotation.z=-t*360);const tangent=route.getTangentAt(.07+t*.86);traveler.rotation.y=-Math.atan2(tangent.z,tangent.x);
}
function updateUI(p){document.querySelector('#positionText').textContent=`${Math.round(p*100)}%`;document.querySelector('#progressFill').style.transform=`scaleX(${p})`;
  const next=p<.17?-1:p<.46?0:p<.75?1:2;
  if(next!==active){active=next;chapters.forEach((button,i)=>{button.classList.toggle('active',i===active);button.setAttribute('aria-current',i===active?'step':'false');});}
}
function staticMode(){document.body.classList.add('static-mode');canvas.hidden=true;cards.forEach(card=>{card.removeAttribute('aria-hidden');card.inert=false;});document.querySelector('#positionText').textContent='Overview';}
if(reduced || new URLSearchParams(location.search).get('view')==='static'){staticMode();}else{
  try{
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.shadowMap.enabled=!mobile;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.4:1.8));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
    buildWorld();document.body.classList.add('webgl-ready');
    const stage=document.querySelector('.stage');const resize=()=>{const width=stage.clientWidth,height=stage.clientHeight;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();};resize();resizeObserver=new ResizeObserver(resize);resizeObserver.observe(stage);
    const timeline=gsap.timeline({scrollTrigger:{trigger:'.scroll-story',start:'top top',end:()=>`+=${innerHeight*(mobile?4:4.7)}`,pin:'.stage',scrub:.8,invalidateOnRefresh:true,onUpdate:self=>updateUI(self.progress)}});
    timeline.to(state,{progress:1,duration:1,ease:'none'},0);
    timeline.to('.story-copy',{autoAlpha:0,y:-30,duration:.1},.055);
    cards.forEach((card,i)=>{const starts=[.17,.46,.75];timeline.fromTo(card,{autoAlpha:0,y:25},{autoAlpha:1,y:0,duration:.035},starts[i]);if(i<2)timeline.to(card,{autoAlpha:0,y:-18,duration:.035},starts[i+1]-.04);});
    trigger=timeline.scrollTrigger;
    let visible=true;const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;},{rootMargin:'100px'});observer.observe(stage);
    const render=()=>{frame=requestAnimationFrame(render);if(visible&&!document.hidden){updateCamera(state.progress);cards.forEach((card,i)=>{card.setAttribute('aria-hidden',String(i!==active));card.inert=i!==active;});renderer.render(scene,camera);}};render();
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();trigger.kill(true);cancelAnimationFrame(frame);document.body.classList.remove('webgl-ready');gsap.set('.story-copy',{clearProps:'all'});gsap.set(cards,{clearProps:'all'});staticMode();});
    window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);resizeObserver.disconnect();observer.disconnect();renderer.dispose();},{once:true});
  }catch(error){console.warn('3D unavailable; showing the accessible panorama view.',error);if(trigger)trigger.kill(true);staticMode();}
}
chapters.forEach((button,i)=>button.addEventListener('click',()=>{if(!trigger)return;const target=[.28,.59,.89][i];window.scrollTo({top:trigger.start+(trigger.end-trigger.start)*target,behavior:'smooth'});}));
if(!reduced){animate('.brand-mark',{opacity:[0,1],rotate:[-25,0],duration:900,ease:'out(3)'});document.querySelectorAll('.button,.sign-in').forEach(button=>{button.addEventListener('pointerenter',()=>animate(button,{scale:1.035,duration:230,ease:'out(3)'}));button.addEventListener('pointerleave',()=>animate(button,{scale:1,duration:250,ease:'out(3)'}));});document.querySelectorAll('.grid-icon').forEach(icon=>{icon.addEventListener('pointerenter',()=>animate(icon,{rotate:[0,-8,8,0],duration:500}));});}






