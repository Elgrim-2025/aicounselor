export const SCENARIOS = [
  {
    id: 'violence',
    emoji: '🚨',
    title: '학교폭력 피해',
    subtitle: '친구에게 폭력을 당한 상황',
    type: 'chat',
    turns: [
      { who: 'me', type: 'text', text: '선생님, 드릴 말씀이 있어요... 어제 학교에서 애들 몇 명이 나를 때렸어요.' },
      { who: 'bot', type: 'text', text: '그런 일이 있었구나, 얘기해줘서 고마워. 많이 놀라고 아팠겠다. 지금 몸은 괜찮아? 어디 다친 데는 없어?' },
      { who: 'me', type: 'text', text: '팔이랑 등에 멍이 좀 들었어.' },
      { who: 'bot', type: 'text', text: '그랬구나. 혹시 다친 부분이나 그때 상황을 사진으로 남겨둘 수 있을까? 나중에 도움이 많이 될 거야.' },
      { who: 'me', type: 'photo' },
      { who: 'bot', type: 'text', text: '잘 받았어. 이 사진은 상담선생님께 안전하게, 너의 동의 하에만 전달돼. [기록됨]' },
      { who: 'bot', type: 'text', text: '언제, 어디서, 누가 그랬는지도 기억나는 만큼 말해줄 수 있어?' },
      { who: 'me', type: 'text', text: '어제 방과 후에 체육관 뒤에서, 같은 반 애들 세 명이었어.' },
      { who: 'bot', type: 'text', text: '말해줘서 정말 고마워. 너는 잘못한 게 하나도 없어. 이 내용은 담당 상담선생님께 바로 전달할게. 선생님이 곧 너에게 연락드릴 거야.' },
      { who: 'bot', type: 'text', text: '지금 이 순간이 무섭거나 불안하면 1388 청소년 상담전화로 언제든 전화해도 괜찮아. 오늘 얘기해줘서 고마워, 다솜아.' },
    ],
  },
  {
    id: 'depression',
    emoji: '💧',
    title: '우울감·무기력',
    subtitle: '마음이 가라앉는 시기',
    type: 'chat',
    turns: [
      { who: 'me', type: 'text', text: '선생님... 요즘 아무것도 하기 싫고 재미가 없어요. 학교 가는 것도 힘들어요.' },
      { who: 'bot', type: 'text', text: '그런 마음이었구나, 말해줘서 고마워. 언제부터 그런 기분이 들었어?' },
      { who: 'me', type: 'text', text: '한 2주 정도 된 것 같아. 잠도 잘 못 자.' },
      { who: 'bot', type: 'text', text: '많이 지쳤겠다. 잠도 못 자고 기분까지 가라앉으면 정말 힘들어. 밥은 잘 챙겨 먹고 있어?' },
      { who: 'me', type: 'text', text: '입맛도 별로 없어서 대충 먹어.' },
      { who: 'bot', type: 'text', text: '네가 겪고 있는 게 얼마나 힘든 건지 알아주고 싶어. 혹시 괜찮으면 짧은 정서 검사(PHQ-9)로 지금 상태를 같이 확인해볼래? 3분이면 끝나.' },
      { who: 'me', type: 'text', text: '응, 해볼게.' },
      { who: 'bot', type: 'text', text: '좋아. 검사 결과는 상담선생님께도 함께 전달돼서, 필요하면 먼저 연락드릴 수 있어. 지금처럼 힘든 마음이 들 때는 혼자 참지 말고 나한테 언제든 이야기해줘.' },
      { who: 'bot', type: 'text', text: '혹시 마음이 너무 힘들어서 위험한 생각이 들 땐 꼭 1388로 전화하거나 나한테 바로 말해줘. 너는 혼자가 아니야.' },
    ],
  },
  {
    id: 'career',
    emoji: '🧭',
    title: '진로 고민',
    subtitle: '적성과 진로 추천 상담',
    type: 'chat',
    turns: [
      { who: 'me', type: 'text', text: '선생님, 상담 좀 하고 싶어서요. 고2인데 아직도 뭘 하고 싶은지 모르겠어요. 다들 뭔가 정한 것 같은데 나만 없는 느낌이에요.' },
      { who: 'bot', type: 'text', text: '그런 고민이 있었구나, 얘기해줘서 고마워. 그런 조급함, 많은 친구들이 느껴. 평소에 시간 가는 줄 모르고 좋아하는 활동이 있어?' },
      { who: 'me', type: 'text', text: '그림 그리는 거랑, 컴퓨터로 뭔가 만드는 걸 좋아해.' },
      { who: 'bot', type: 'text', text: '오, 창작하고 만드는 걸 좋아하는구나. 그런 흥미라면 디자인이나 개발, 콘텐츠 제작 쪽이 잘 맞을 수도 있어.' },
      { who: 'bot', type: 'text', text: '네 흥미와 강점을 더 정확히 알아보고 싶으면 진로흥미검사를 해보는 것도 추천해. 결과를 바탕으로 관련 학과나 직업도 같이 살펴볼 수 있어.' },
      { who: 'me', type: 'text', text: '오 좋다. 어떤 직업들이 있는지 궁금해.' },
      { who: 'bot', type: 'text', text: 'UX/UI 디자이너, 게임 아트 디렉터, 프론트엔드 개발자, 콘텐츠 크리에이터 같은 직업들이 네 관심사랑 잘 맞을 것 같아. 관심 가는 게 있어?' },
      { who: 'me', type: 'text', text: 'UX 디자이너는 처음 들어봐. 더 알고 싶어.' },
      { who: 'bot', type: 'text', text: '사람들이 앱이나 서비스를 더 쉽고 편하게 쓸 수 있도록 화면과 흐름을 설계하는 직업이야. 그림과 논리적 사고를 같이 쓰는 일이라 네 강점이랑 잘 맞을 수 있어.' },
      { who: 'bot', type: 'text', text: '다음에 만나면 진로흥미검사 결과를 가지고 더 자세히 얘기해보자. 오늘 이야기해줘서 고마워!' },
    ],
  },
  {
    id: 'survey',
    emoji: '📋',
    title: '마음 설문조사',
    subtitle: '선생님 대신 채팅으로 편하게 조사해요',
    type: 'survey',
    scaleOptions: ['전혀 아니다', '가끔 그렇다', '자주 그렇다', '매우 그렇다'],
    questions: [
      { category: '정서', text: '기분이 가라앉거나 우울하다고 느꼈다', answerIndex: 1 },
      { category: '정서', text: '사소한 일에도 화가 나거나 짜증이 났다', answerIndex: 1 },
      { category: '정서', text: '잠들기 어렵거나 자주 깼다', answerIndex: 0 },
      { category: '관계', text: '친구들과 어울리기 힘들다고 느꼈다', answerIndex: 1 },
      { category: '관계', text: '반에서 나를 이해해주는 사람이 없다고 느꼈다', answerIndex: 0 },
      { category: '관계', text: '다른 사람들과 갈등이 있었다', answerIndex: 1 },
      { category: '스트레스', text: '학업이나 시험에 대한 부담을 느꼈다', answerIndex: 2 },
      { category: '스트레스', text: '집이나 가족 문제로 스트레스를 받았다', answerIndex: 1 },
    ],
    outro: '선생님께 자동으로 전달돼요. 종이로 일일이 취합하지 않아도 반 전체 마음 상태를 한눈에 볼 수 있어요.',
  },
];

export function scoreSurvey(questions){
  const order = [];
  const sums = {};
  const counts = {};
  for(const q of questions){
    if(!(q.category in sums)){
      sums[q.category] = 0;
      counts[q.category] = 0;
      order.push(q.category);
    }
    sums[q.category] += q.answerIndex;
    counts[q.category] += 1;
  }
  const categories = order.map(name => ({
    name,
    avg: Math.round((sums[name] / counts[name]) * 10) / 10,
  }));
  const topCategory = categories.reduce((a, b) => (b.avg > a.avg ? b : a), categories[0]).name;
  return { categories, topCategory };
}
