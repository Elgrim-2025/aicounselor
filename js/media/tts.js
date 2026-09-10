// Bot-bubble "read aloud". Uses browser speechSynthesis with a Korean voice when one
// exists; otherwise simulates the speaking duration with a timer. Nothing is recorded.

let current = null; // { token, cancel }

const hasSynth = () => typeof window !== 'undefined' && 'speechSynthesis' in window;
if(hasSynth()){
  // Chrome populates voices asynchronously; touching getVoices() once kicks that off.
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

function koVoice(){
  if(!hasSynth()) return null;
  return window.speechSynthesis.getVoices().find(v => /^ko/i.test(v.lang)) || null;
}

export function simulatedDurationMs(text){ return 400 + text.length * 90; }

export function speak(text, { onStart, onEnd } = {}){
  cancel();
  const token = {};
  let ended = false;
  const done = () => {
    if(ended) return;
    ended = true;
    if(current && current.token === token) current = null;
    onEnd && onEnd();
  };
  const voice = koVoice();
  if(voice){
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice; u.lang = voice.lang; u.rate = 1;
    u.onend = done; u.onerror = done;
    current = { token, cancel: () => { window.speechSynthesis.cancel(); done(); } };
    window.speechSynthesis.speak(u);
  } else {
    const t = setTimeout(done, simulatedDurationMs(text));
    current = { token, cancel: () => { clearTimeout(t); done(); } };
  }
  onStart && onStart();
}

export function cancel(){
  if(!current) return;
  const c = current;
  current = null;
  c.cancel();
}
