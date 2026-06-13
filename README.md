# Solar Drift

Three.js로 만든 태양계 자유 비행 시뮬레이터입니다.

## Vercel 배포

이 프로젝트는 정적 웹앱입니다. GitHub 저장소를 Vercel에 연결하면 `index.html`, `styles.css`, `app.js`가 Vercel에서 직접 호스팅됩니다.

데스크탑에서 실행하는 `server.mjs`는 로컬 미리보기용일 뿐이며, Vercel 배포본은 개인 PC가 꺼져 있어도 계속 동작합니다.

Vercel 설정:

- Framework Preset: `Other`
- Build Command: 비워둠
- Output Directory: 비워둠 또는 `.`

## 로컬 실행

```bash
node server.mjs
```

그 다음 `http://127.0.0.1:4173`을 엽니다.

## 바다 버전

심해 항행 시뮬레이터는 별도 진입점으로 추가되어 있습니다.

- 우주 버전: `http://127.0.0.1:4173/`
- 바다 버전: `http://127.0.0.1:4173/ocean.html`

Vercel 배포 후에는 바다 버전을 `/ocean` 주소로도 열 수 있습니다.

## 심해 픽셀 탐험 게임 (Deep Pixel Sea)

픽셀 도트 스타일의 2D 심해 탐험 게임 MVP가 별도 진입점으로 추가되었습니다.

- 로컬: `http://127.0.0.1:4173/game.html`
- Vercel 배포: `/game` 주소로도 열 수 있습니다.

밝은 수면에서 시작해 점점 어두운 심해로 내려가며, 산소와 체력을 관리하고
적대 생물을 피하거나 공격하고 우호 생물과 교감하며 더 깊이 탐험합니다.

- 조작 (PC): 이동 `WASD`/방향키, 기본 공격 `Space`, 대시 `Q`, 빛 폭발 `E`,
  상호작용 `F`, 생물 도감 `Tab`, 일시정지 `Esc`. 모바일은 화면 좌하단 방향 패드와
  우하단 액션 버튼으로 조작합니다.
- 깊이에 따라 햇빛 바다 → 중층 바다 → 심해 → 초심해로 분위기가 변하고,
  심해부터는 잠수정 주변만 밝게 보입니다. 약 1780m 부근에서 거대 생물과 조우합니다.
- 엔진은 Phaser 3(CDN)이며 빌드 단계가 없습니다. 모든 그래픽은 코드로 생성한 임시
  픽셀 도형이라 외부 이미지 없이 실행되며, 나중에 PNG 스프라이트로 교체하기 쉽도록
  `game/` 폴더가 씬·엔티티·시스템·데이터로 분리되어 있습니다.

코드 구조:

```
game/
  main.js            # Phaser 설정 + 씬 등록
  config.js          # 공통 상수(깊이 ↔ 픽셀 변환 등)
  scenes/            # Boot(텍스처 생성) · Menu · Game · Result
  entities/          # Player · Enemy · FriendlyCreature · Projectile · Item
  systems/           # Depth · Oxygen · Combat · Spawn · Lighting
  ui/                # Hud (체력/산소/에너지 바, 깊이, 스킬 버튼, 도감, 일시정지)
  data/              # zones · creatures · items (난이도·콘텐츠는 여기서 조정)
```

바다 버전(`ocean.html`)은 손그림 애니메이션 영화 속 수중 장면 안으로 들어가 천천히 헤엄쳐 지나가는 **2.5D 레이어 체험**입니다. 3D 바다를 만들고 만화 필터를 씌우는 방식이 아니라, 캔버스로 직접 그린 손그림 컷아웃(스프라이트)을 전경·중경·원경 레이어로 쌓아 시차로 움직입니다.

- 전경: 큰 해초 실루엣, 큰 물방울, 가까이 스치는 작은 생물. 중경: 둥근 물고기 떼·해파리·부유 물방울·부드러운 물결선. 원경: 수면빛·빛기둥·깊은 바다 실루엣.
- 물·파도·거품·생물은 물리 시뮬레이션이 아니라 손그림 루프 애니메이션(프레임 사이클·주기 모션)으로 움직입니다.
- 앞으로 헤엄치면 뒤로 지나간 레이어가 재배치되어 새로운 수중 장면이 계속 나타납니다.
- 조작: `W A S D` 헤엄, `Space`/`C` 상승·하강, `Shift` 가속, 드래그로 시점(제한적), `R`로 처음 위치. 모바일은 화면 좌하단 방향 버튼.

## 참고

Three.js는 브라우저에서 jsDelivr CDN을 통해 불러옵니다. 행성 텍스처는 Solar System Scope의 무료 텍스처를 `assets/textures`에 포함해 Vercel에서 함께 호스팅합니다. 따라서 배포본은 개인 데스크탑이나 외부 텍스처 서버에 의존하지 않습니다. 다만 사용자의 브라우저가 Three.js CDN에는 접근할 수 있어야 합니다.

## 텍스처 출처

Planet textures: [Solar System Scope](https://www.solarsystemscope.com/textures/), distributed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

Solar System Scope는 해당 텍스처가 NASA elevation and imagery data를 기반으로 한다고 설명합니다.
