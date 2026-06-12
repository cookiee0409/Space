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

바다 버전은 "만화 바다를 시뮬레이터처럼 체험"하는 몰입형 경험입니다. 계기판이나 미니게임 대신, 지브리·포뇨풍의 따뜻한 에메랄드 바다 그 자체를 자유롭게 헤엄치며 둘러봅니다.

- 살아있는 만화 바다: 층층이 쌓인 산호 마을(돔), 무성한 해초 숲, 알록달록한 물고기 떼, 떠다니는 해파리·물방울, 부채꼴 빛기둥, 해저 커스틱.
- 조작: `W A S D` 헤엄, `Space`/`C` 상승·하강, `Shift` 가속, 마우스 드래그로 시점, 휠로 줌, `R`로 처음 위치 복귀. 모바일은 화면 좌하단 방향 버튼.
- 깊이 내려갈수록 배경·안개가 밝은 청록에서 진한 에메랄드로 변하고, 수면을 클릭하면 카툰풍 파문이 퍼집니다.

## 참고

Three.js는 브라우저에서 jsDelivr CDN을 통해 불러옵니다. 행성 텍스처는 Solar System Scope의 무료 텍스처를 `assets/textures`에 포함해 Vercel에서 함께 호스팅합니다. 따라서 배포본은 개인 데스크탑이나 외부 텍스처 서버에 의존하지 않습니다. 다만 사용자의 브라우저가 Three.js CDN에는 접근할 수 있어야 합니다.

## 텍스처 출처

Planet textures: [Solar System Scope](https://www.solarsystemscope.com/textures/), distributed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

Solar System Scope는 해당 텍스처가 NASA elevation and imagery data를 기반으로 한다고 설명합니다.
