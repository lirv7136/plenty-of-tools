/* One short utterance at a time. Tokens discard late events after stop or skip. */
(function(root,factory){const api=factory(typeof module==='object'?require('./core.js'):root.ReadAloudCore);if(typeof module==='object')module.exports=api;else root.ReadAloudPlayer=api;})(globalThis,function(C){
  class Player{
    constructor(synth,Utterance,onPosition,onState){this.synth=synth;this.Utterance=Utterance;this.onPosition=onPosition;this.onState=onState;this.items=[];this.index=0;this.part=0;this.token=0;this.state='stopped';this.timer=null;this.utterance=null;this.options={rate:1,pitch:1};}
    set(items,index=0){this.stop();this.items=items;this.index=index;this.part=0;}
    stateTo(state,message=''){this.state=state;this.onState(state,message);}
    stop(){this.token++;clearTimeout(this.timer);this.synth.cancel();this.utterance=null;this.stateTo('stopped');}
    play(options){
      if(!this.items.length)return;this.options=options;
      if(this.state==='paused'){this.synth.resume();this.stateTo('playing');if(this.utterance)this.watch();else this.speak();return;}
      this.stop();if(this.index>=this.items.length){this.index=0;this.part=0;}this.stateTo('playing');this.speak();
    }
    pause(){if(this.state!=='playing')return;this.synth.pause();clearTimeout(this.timer);this.stateTo('paused');}
    seek(index,play=false){this.stop();this.index=index;this.part=0;this.onPosition(this.index,this.items[index]?.start||0);if(play){this.stateTo('playing');this.speak();}}
    watch(){clearTimeout(this.timer);this.timer=setTimeout(()=>{if(this.state==='playing'){this.stop();this.stateTo('error','The voice stopped responding. Press Play to retry this part, or choose another voice.');}},20000+(this.utterance?.text.length||0)/6/this.options.rate*1000);}
    speak(){
      if(this.state!=='playing')return;
      if(this.index>=this.items.length){this.onPosition(this.index,this.items.at(-1)?.end||0);this.stateTo('finished');return;}
      const sentence=this.items[this.index],parts=C.chunks(sentence.text),part=parts[this.part],token=++this.token,u=new this.Utterance(part.text);this.utterance=u;
      u.voice=this.options.voice;u.lang=this.options.voice?.lang||'';u.rate=this.options.rate;u.pitch=this.options.pitch;
      this.onPosition(this.index,sentence.start+part.offset);this.watch();
      u.onend=()=>{if(token!==this.token)return;clearTimeout(this.timer);this.utterance=null;this.part++;if(this.part>=parts.length){this.index++;this.part=0;}if(this.state==='playing')this.speak();};
      u.onerror=e=>{if(token!==this.token)return;this.stop();this.stateTo('error','This voice could not read the text ('+String(e.error||'speech error')+'). Choose another installed voice and try again.');};
      try{this.synth.resume();this.synth.speak(u);}catch{this.stop();this.stateTo('error','Speech is unavailable. Try a browser with an installed local voice.');}
    }
  }
  return {Player};
});
