export const routes = {};
export function registerRoute(path, renderFn){ routes[path] = renderFn; }
export function navigate(path){ location.hash = path; }

const STUDENT_TABS = [
  { path:'/student/chat', label:'채팅' },
  { path:'/student/diary', label:'감정일기' },
  { path:'/student/tests', label:'검사' },
  { path:'/student/report', label:'리포트' },
];

const TEACHER_NAV = [
  { path:'/teacher/dashboard', label:'대시보드' },
  { path:'/teacher/alerts', label:'알림센터' },
  { path:'/teacher/students', label:'학생 관리' },
  { path:'/teacher/group', label:'그룹 관리' },
  { path:'/teacher/account', label:'계정 관리' },
  { path:'/teacher/audit', label:'감사 로그' },
  { path:'/teacher/violence', label:'학교폭력 접수' },
  { path:'/teacher/keyword', label:'키워드 사전' },
  { path:'/teacher/threshold', label:'임계치 설정' },
];

function studentShell(path, bodyHtml, opts={}){
  const activeTab = STUDENT_TABS.find(t => path.startsWith(t.path));
  return `
  <div class="student-shell">
    <div class="student-topbar">
      ${opts.back ? `<button class="icon-btn" data-go="${opts.back}">‹</button>` : ''}
      <div class="title">${opts.title || ''}</div>
      ${opts.headerExtra || ''}
      <button class="role-switch" data-go="/select">역할전환</button>
    </div>
    <div class="student-body${opts.bodyClass ? ' ' + opts.bodyClass : ''}">${bodyHtml}</div>
    ${opts.hideTabs ? '' : `<div class="student-tabbar">
      ${STUDENT_TABS.map(t=>`<button data-go="${t.path}" class="${t===activeTab?'active':''}">${t.label}</button>`).join('')}
    </div>`}
  </div>`;
}

function teacherShell(path, bodyHtml){
  return `
  <div class="teacher-shell">
    <div class="teacher-sidebar">
      <div class="sidebar-head">학생 AI 상담 학교</div>
      ${TEACHER_NAV.map(n=>`<button data-go="${n.path}" class="${path.startsWith(n.path)?'active':''}">${n.label}</button>`).join('')}
      <button class="role-switch" data-go="/select">역할전환</button>
    </div>
    <div class="teacher-main">${bodyHtml}</div>
  </div>`;
}

export function renderStudent(root, path, bodyHtml, opts){
  root.innerHTML = studentShell(path, bodyHtml, opts);
  bindNav(root);
}
export function renderTeacher(root, path, bodyHtml){
  root.innerHTML = teacherShell(path, bodyHtml);
  bindNav(root);
}
function bindNav(root){
  root.querySelectorAll('[data-go]').forEach(b=>
    b.addEventListener('click', ()=>navigate(b.dataset.go)));
}

export function startRouter(){
  window.addEventListener('hashchange', renderCurrent);
  renderCurrent();
}
function renderCurrent(){
  const path = location.hash.slice(1) || '/select';
  const exact = routes[path];
  if(exact){ exact(document.getElementById('app'), path); return; }
  // param routes: /teacher/students/:id, /teacher/session/:id
  for(const key of Object.keys(routes)){
    if(!key.includes(':')) continue;
    const pattern = '^' + key.replace(/:[^/]+/g, '([^/]+)') + '$';
    const m = path.match(new RegExp(pattern));
    if(m){ routes[key](document.getElementById('app'), path, m[1]); return; }
  }
  routes['/select'](document.getElementById('app'), path);
}
