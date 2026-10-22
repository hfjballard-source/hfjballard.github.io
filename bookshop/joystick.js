/* One captured pointer, radial dead zone, analog speed, and release-to-stop. */
(() => {
  'use strict';
  class BookshopJoystick {
    constructor(element,change,allowed=()=>true){
      this.element=element;this.change=change;this.allowed=allowed;this.pointer=null;
      element.addEventListener('pointerdown',e=>{
        if(this.pointer!==null||e.isPrimary===false||(e.button!==undefined&&e.button!==0)||!allowed())return;
        e.preventDefault();this.pointer=e.pointerId;element.setPointerCapture(e.pointerId);
        element.classList.add('is-held');this.update(e);
      });
      element.addEventListener('pointermove',e=>{if(e.pointerId===this.pointer){if(!allowed()){this.reset();return}e.preventDefault();this.update(e)}});
      for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,e=>{if(e.pointerId===this.pointer)this.reset()});
      window.addEventListener('blur',()=>this.reset());
      document.addEventListener('visibilitychange',()=>this.reset());
    }
    update(e){
      const r=this.element.getBoundingClientRect(),radius=Math.max(1,Math.min(r.width,r.height)*.3);
      const dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,distance=Math.hypot(dx,dy);
      const extent=Math.min(distance,radius),strength=Math.min(1,distance/radius);
      this.element.style.setProperty('--stick-x',(distance?dx/distance*extent:0)+'px');
      this.element.style.setProperty('--stick-y',(distance?dy/distance*extent:0)+'px');
      const speed=strength<=.15?0:(strength-.15)/.85;
      this.change({x:distance?dx/distance*speed:0,y:distance?dy/distance*speed:0});
    }
    reset(){
      const pointer=this.pointer;this.pointer=null;
      this.element.classList.remove('is-held');this.element.style.setProperty('--stick-x','0px');this.element.style.setProperty('--stick-y','0px');
      this.change({x:0,y:0});
      if(pointer!==null&&this.element.hasPointerCapture(pointer))this.element.releasePointerCapture(pointer);
    }
  }
  window.BookshopJoystick=BookshopJoystick;
})();
