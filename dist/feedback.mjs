// Units are CSS screen pixels, independent of world zoom and device size.
export const FEEDBACK_KEY='hillside-archers-feedback-v1';
export const FEEDBACK_MODES=['light','standard','off'];
export function readFeedback(storage){try{const x=storage?.getItem(FEEDBACK_KEY);return FEEDBACK_MODES.includes(x)?x:'light';}catch{return 'light';}}
export class ImpactFeedback{
 constructor(mode='light'){this.mode=FEEDBACK_MODES.includes(mode)?mode:'light';this.reset();}
 reset(){this.age=1;this.duration=0;this.peak=0;this.volleyPeak=0;this.direction=1;}
 beginVolley(){this.reset();}
 hit({head=false,burst=false,dir=1}={}){
  const strength=head?3.6:burst?2.8:1.9;
  // Only a stronger hit can replace the impulse in this volley. Multi-arrow
  // volleys don't stack camera movement or keep restarting the decay.
  if(strength<=this.volleyPeak)return false;
  this.volleyPeak=strength;this.peak=strength;this.age=0;this.duration=head?.16:.12;this.direction=Math.sign(dir)||1;return true;
 }
 update(dt,{reduced=false,scale=1}={}){
  this.age+=Math.max(0,dt);if(reduced||this.mode==='off'||!this.duration||this.age>=this.duration)return {x:0,y:0};
  const u=this.age/this.duration,decay=(1-u)**2,gain=this.mode==='light'?.58:1;
  const x=this.peak*gain*decay*Math.cos(u*Math.PI*3)*this.direction;
  return {x:x*scale,y:this.peak*gain*.35*decay*Math.sin(u*Math.PI*2)*scale};
 }
}
