# Healing Music Library

개인용 힐링 뮤직 플레이리스트 로컬 MVP입니다. 목록, 상세 재생, 링크 추가, 로컬 탐색 요청, Google YouTube Data API 선택 적용, 50:50 추천, 시간대 자동 선곡, 분위기 기반 테마 변경을 검증할 수 있게 만들었습니다.

## 실행

```bash
npm install
npm run dev -- --port 5173
```

로컬 주소: `http://127.0.0.1:5173/`

## GitHub Pages 배포

`main` 브랜치에 push하면 `.github/workflows/deploy-pages.yml`이 `npm ci`, `npm run build`를 실행한 뒤 `gh-pages` 브랜치에 정적 산출물을 배포합니다. GitHub 저장소의 `Settings > Pages`에서 Source를 `Deploy from a branch`, Branch를 `gh-pages` / `/root`로 설정하면 스마트폰에서도 Pages URL로 접속할 수 있습니다.

YouTube 검색 기능까지 배포 사이트에서 쓰려면 저장소의 `Settings > Secrets and variables > Actions`에 아래 secret을 추가하세요.

```bash
VITE_YOUTUBE_DATA_API_KEY
```

## 구현 범위

- 전체 음악 목록에서 곡을 클릭하면 상세 재생 화면으로 이동
- YouTube 링크는 일반 `youtube.com/embed` iframe과 origin/inline playback 파라미터로 앱 안에서 재생
- Suno, Udio, Stable Audio 같은 음악생성앱 링크를 개인 창작 음악 소스로 저장
- 직접 오디오 파일 URL(`mp3`, `wav`, `m4a`, `ogg`, `flac` 등)은 앱 안에서 `<audio>`로 재생
- 사용자가 직접 링크와 기본 정보를 추가하면 `localStorage`에 저장
- “찾아줘” 요청은 로컬 큐레이션 카탈로그에서 먼저 매칭하고, YouTube Data API가 설정되어 있으면 YouTube 음악 결과에서도 추가 가능
- 상세 화면은 소스 분석, 썸네일, 제목/아티스트/장르/분위기/검증 점수/검증 신호를 표시
- 가사는 API 연결 전 자리만 유지
- 추천은 개인 레인 50%, 트렌드/큐레이션 레인 50% 비율을 유지
- 선택 곡의 대표 분위기에 따라 색, 배경, 미터, 표면감이 변경
- 시간대 자동 선곡은 사용자 클릭 후 활성화되며 현재 시간대에 맞는 곡으로 이동
- 사용자 추가곡은 상세 화면에서 삭제 가능

## Google API 설정

이 MVP에는 Google의 YouTube Data API v3를 적용했습니다. Google Custom Search JSON API는 공식 문서 기준으로 신규 고객에게 닫혀 있어 장기적으로 덜 적합하고, 이 앱의 “사용자가 찾아달라는 음악 추가”에는 YouTube 검색 결과와 임베드 URL을 바로 연결할 수 있는 YouTube Data API가 더 안전합니다. Suno/Udio 같은 음악생성앱에서 만든 곡은 직접 링크 저장으로 처리합니다.

`.env.example`을 참고해 `.env.local`을 만들고 값을 채우세요.

```bash
VITE_YOUTUBE_DATA_API_KEY=your_youtube_data_api_key
```

설정 후 개발 서버를 다시 시작하면 “찾아줘” 탭의 `YouTube 검색` 버튼이 활성화됩니다. 개인 로컬 앱이어도 브라우저 번들에 키가 들어가므로 Google Cloud Console에서 HTTP referrer 제한을 걸어두는 것을 권장합니다.

## 루프 엔지니어링

1. 계획 수립: 로컬 MVP와 향후 API provider 확장을 분리
2. 화면 설계: 목록, 추가 패널, 추천 레일, 상세 재생 화면으로 구성
3. 작업 설계: 소스 분석, 추천, 시간대, 테마를 순수 함수로 분리
4. 검증 및 피드백: 단위 테스트, 빌드, 브라우저 상호작용으로 검증
5. 개선 루프: 브라우저 검증 중 사용자 추가곡 삭제 기능을 추가
6. 완결 검증: audit, test, build, 실제 브라우저 플로우를 재확인

## 하네스

핵심 로직은 UI와 분리되어 테스트됩니다.

```bash
npm run test
npm run build
npm audit --audit-level=moderate
```

테스트 대상:

- YouTube URL 분석 및 autoplay URL 생성
- Suno/Udio/Stable Audio/직접 오디오 파일 소스 분석
- YouTube Data API 검색 URL 생성 및 결과 정규화
- 추천 레인의 50:50 비율
- 객관 검증 점수 하한 필터
- 시간대 판정 및 시간대 곡 선택
- 곡 분위기 기반 CSS 변수 생성

## 다음 확장 지점

- `src/lib/source.ts`: YouTube/Spotify/SoundCloud/Suno/Udio provider 실제 메타데이터 연결
- `src/lib/youtubeData.ts`: YouTube Data API v3 검색 호출
- `src/lib/discovery.ts`: 로컬 벡터 검색 또는 추가 큐레이션 연결
- `src/lib/recommendations.ts`: 청취 이력, 좋아요, 시간대 반응을 반영한 추천 강화
- 가사 API: 저작권 정책이 명확한 provider만 연결
