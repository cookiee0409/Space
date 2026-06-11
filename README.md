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

## 참고

Three.js는 브라우저에서 jsDelivr CDN을 통해 불러옵니다. 행성 텍스처는 Solar System Scope의 무료 텍스처를 `assets/textures`에 포함해 Vercel에서 함께 호스팅합니다. 따라서 배포본은 개인 데스크탑이나 외부 텍스처 서버에 의존하지 않습니다. 다만 사용자의 브라우저가 Three.js CDN에는 접근할 수 있어야 합니다.

## 텍스처 출처

Planet textures: [Solar System Scope](https://www.solarsystemscope.com/textures/), distributed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

Solar System Scope는 해당 텍스처가 NASA elevation and imagery data를 기반으로 한다고 설명합니다.
