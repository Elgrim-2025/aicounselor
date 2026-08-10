export function comingSoonBody(title, fid){
  return `
    <div style="text-align:center;padding:60px 10px;">
      <div style="font-size:36px;margin-bottom:10px;">🔒</div>
      <h3 style="margin:0 0 6px;">${title}</h3>
      <p style="color:var(--ink-soft);font-size:12.5px;">${fid} · P2 로드맵 — 프로토타입에서는 준비 중이에요.</p>
    </div>`;
}

export function openReasonDialog({ title, message, onConfirm }){
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal-box">
      <b style="font-size:14px;">${title}</b>
      <p style="font-size:12px;color:var(--ink-soft);margin:6px 0;">${message}</p>
      <textarea placeholder="해제 사유를 입력하세요"></textarea>
      <div class="row">
        <button class="btn ghost" data-cancel>취소</button>
        <button class="btn danger" data-confirm disabled>해제</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  const textarea = backdrop.querySelector('textarea');
  const confirmBtn = backdrop.querySelector('[data-confirm]');
  textarea.addEventListener('input', ()=>{ confirmBtn.disabled = textarea.value.trim().length===0; });
  backdrop.querySelector('[data-cancel]').addEventListener('click', ()=>backdrop.remove());
  confirmBtn.addEventListener('click', ()=>{ onConfirm(textarea.value.trim()); backdrop.remove(); });
}
