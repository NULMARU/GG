# Healing Music Library

개인용 힐링 뮤직 플레이리스트 앱입니다.  
배포 주소: [https://nulmaru.github.io/GG/](https://nulmaru.github.io/GG/)

열자마자 **지금 시간대 곡을 재생**하고, 목록을 검색·필터링하고, 곡이 끝나면 **다음 곡으로 이어 듣는** 흐름에 맞춰 구성되어 있습니다. 데이터는 브라우저 `localStorage`에 저장되며, 설정에서 JSON 백업/복원을 할 수 있습니다.

## 실행

```bash
npm install
npm run dev -- --port 5173
```

로컬 주소: `http://127.0.0.1:5173/`

## GitHub Pages 배포

`main` 브랜치에 push하면 `.github/workflows/deploy-pages.yml`이 `npm ci`, `npm run build`를 실행한 뒤 `gh-pages` 브랜치에 정적 산출물을 배포합니다.

YouTube 검색까지 배포 사이트에서 쓰려면 저장소 Secrets에 아래를 넣으세요.

```bash
VITE_YOUTUBE_DATA_API_KEY
```

## 스마트폰 설치 (PWA)

1. `https://nulmaru.github.io/GG/` 를 엽니다.
2. 브라우저 메뉴에서 **앱 설치** 또는 **홈 화면에 추가**를 선택합니다.
3. 예전 바로가기가 있으면 삭제 후 다시 추가하면 새 아이콘/캐시가 적용됩니다.

## 주요 기능

### 바로 듣기
- 홈 상단 **지금 재생** / **셔플**: 현재 시간대 + 좋아요 선호를 반영해 즉시 재생
- **자동 선곡**: 시간대가 바뀌면 맞는 곡으로 이동
- **연속 재생**: YouTube 곡 종료 시 다음 곡으로 (설정/미니플레이어에서 토글)
- **이전/다음/셔플** 컨트롤

### 라이브러리
- 검색 (제목·아티스트·장르)
- 필터: 전체 / 지금 / 좋아요 / 내 곡 / 최근
- 분위기 칩 필터
- 목록 하단 **미니 플레이어**로 탐색 중에도 현재 곡 제어
- 마지막 곡·필터·연속재생 설정 자동 복원

### 소스 추가
- YouTube / Suno·Udio / 직접 오디오 URL / 기타 링크
- **자동 채우기**로 제목·썸네일 추정
- 세부 설정(시간대·에너지·가사)은 접어서 빠른 추가 가능
- “찾아줘”로 로컬 큐레이션 매칭 + (선택) YouTube Data API 검색

### 백업
- 설정 → **라이브러리 내보내기 / 백업 가져오기**
- 기기 변경 전 JSON 백업 권장

## Google API 설정 (선택)

`.env.example`을 참고해 `.env.local`을 만드세요.

```bash
VITE_YOUTUBE_DATA_API_KEY=your_youtube_data_api_key
```

브라우저 번들에 키가 들어가므로 Google Cloud Console에서 HTTP referrer 제한을 권장합니다.

## 검증

```bash
npm run test
npm run build
```

테스트 범위:
- 소스 URL 분석, YouTube 메타데이터, 추천 50:50
- 시간대 선곡, 라이브러리 필터/재생 기록
- 설정 저장 및 백업 import/export
