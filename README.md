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
