import { registerRoute, startRouter, navigate } from './router.js';
import './screens/student.js';
import './screens/teacher.js';

registerRoute('/select', (root) => {
  root.innerHTML = `
    <div class="select-screen">
      <h1>학생 AI 상담 플랫폼</h1>
      <p>데모용 목업입니다. 실제 로그인 없이 역할을 선택해 화면을 둘러보세요.</p>
      <div class="select-cards">
        <div class="select-card">
          <div class="emoji">🧑‍🎓</div>
          <h2>학생 화면</h2>
          <p>AI 채팅, 기분 체크인, 자가진단 검사를 체험합니다.</p>
          <button data-go="/student/chat">학생화면으로 접속</button>
        </div>
        <div class="select-card">
          <div class="emoji">🧑‍🏫</div>
          <h2>선생님 화면</h2>
          <p>상담사·관리자 대시보드와 위기 알림을 체험합니다.</p>
          <button data-go="/teacher/dashboard">선생님화면으로 접속</button>
        </div>
      </div>
    </div>`;
  root.querySelectorAll('[data-go]').forEach(b=>
    b.addEventListener('click', ()=>navigate(b.dataset.go)));
});

startRouter();
