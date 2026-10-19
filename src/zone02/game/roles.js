// 직업 정의 (12명, 직업은 하나씩). 규칙 설명은 docs/게임규칙_v0.2_12인.md
// team: citizen(시민팀) / mafia(마피아팀) / cult(제3세력)
// night: 밤 능력 종류 — target 이 필요한 것은 밤 시작 때 대상을 고른다
export const ROLES = {
  doctor: { name: '의사', icon: '💊', team: 'citizen', night: 'medicine', target: true,
    desc: '밤마다 죽을 것 같은 사람 1명에게 약을 줍니다(가까이 가면 건네줘요). 그 사람이 습격당하면 약으로 한 번 살아요. 약으로 살린 사람에게는 다시 줄 수 없어요.\n또 습격당한 사람을 5초 안에 곁에서 치료하면 살릴 수 있어요. (곁에 오래 있으면 치료돼요)' },
  police: { name: '경찰', icon: '🚔', team: 'citizen', night: 'investigate', target: true,
    desc: '밤마다 1명을 골라 가까이 가서 조사하면 마피아팀인지 시민팀인지 알 수 있어요. 마피아팀이면 그 사람은 강제로 마피아 복장이 돼요. V 키로 긴급 호루라기를 불 수 있어요.' },
  detective: { name: '사립탐정', icon: '🕵️', team: 'citizen', night: 'passive', target: false,
    desc: '마피아의 발자국은 파란색, 마피아에게 죽은 사람의 발자국은 빨간색으로 보여요. 다른 사람들에게는 발자국이 보이지 않아요.' },
  medium: { name: '영매', icon: '🔮', team: 'citizen', night: 'passive', target: false,
    desc: '죽은 사람들이 유령으로 보이고, G 키로 유령과 대화해 정보를 들을 수 있어요.' },
  reporter: { name: '기자', icon: '📷', team: 'citizen', night: 'camera', target: false,
    desc: 'C 키로 사진을 찍어요. 찍은 사진은 사진첩(P 키)에 기록되어 모두가 볼 수 있어요.' },
  vigilante: { name: '자경단원', icon: '🔫', team: 'citizen', night: 'shoot', target: true, optional: true,
    desc: '밤에 딱 한 번, 의심되는 1명에게 총을 쏠 수 있어요. 가까이 가서 Space 로 쏴요. 총은 자경단원만 쓸 수 있어요.' },
  soldier: { name: '군인', icon: '🪖', team: 'citizen', night: 'passive', target: false,
    desc: '밤에 마피아나 자경단원에게 죽으면 자신을 죽인 사람과 함께 죽어요.' },
  citizen: { name: '시민', icon: '🙂', team: 'citizen', night: 'none', target: false,
    desc: '아무 능력이 없어요. 최선을 다해 시민팀을 도와요.' },
  mafia: { name: '마피아', icon: '🔪', team: 'mafia', night: 'hunt', target: true,
    desc: '밤마다 도구를 이용해 1명을 죽여요. 평소에는 시민인 척 행동하고, 도구를 주워 사냥할 때만 "정하림"으로 변신해요. 사냥이 끝나면 다시 시민 복장으로 돌아와요.' },
  spy: { name: '스파이', icon: '🕶️', team: 'mafia', night: 'spy', target: true,
    desc: '밤마다 1명을 골라 그 사람의 직업을 알아내요. (결과는 아침에)' },
  tracker: { name: '추적자', icon: '👣', team: 'mafia', night: 'track', target: true,
    desc: '밤마다 1명을 골라 그 사람의 위치와 행동을 파악해요. (결과는 아침에)' },
  cultist: { name: '교주', icon: '🕯️', team: 'cult', night: 'recruit', target: true,
    desc: '밤마다 1명에게 가까이 가서 포교하면 사이비 광신도로 영입해요. 마피아팀은 "마피아"만 빼고 영입할 수 있어요.' },
};
export const ROLE_ORDER = ['doctor', 'police', 'detective', 'medium', 'reporter', 'vigilante', 'soldier', 'citizen', 'mafia', 'spy', 'tracker', 'cultist'];
export const TEAM_NAME = { citizen: '시민팀', mafia: '마피아팀', cult: '제3세력(사이비)' };
export const isMafiaTeam = p => p.team === 'mafia';
