# SEPNP — 모던 기업 홈페이지

모던하고 깔끔한 반응형 기업 홈페이지 예시입니다. 홈(히어로 캐러셀 + 좌우 분할 레이아웃), 견적문의 실시간 목록(SSE), 견적 등록 폼(PHP API)을 포함합니다.

## 특징
- 헤더: 로고, 네비게이션(회사소개/제품소개/견적문의/문의 게시판)
- 바디: 
  - 히어로 캐러셀 (Swiper, CDN)
  - 좌: 제품 이미지 슬라이드 / 우: 실시간 견적문의 목록(SSE)
- 푸터: 회사 정보 및 저작권 표기
- 반응형: PC/모바일 최적화
- 컬러: 화이트/그레이/포인트(하늘색)

## 로컬 실행 (PHP 내장 서버)
PHP가 설치되어 있다면 아래 명령으로 실행할 수 있습니다.

```powershell
cd "c:\Users\송민규\Desktop\SEPNPHP"
php -S 127.0.0.1:8000 -t .
```

브라우저: http://127.0.0.1:8000/index.html

### JSON 폴백 모드 강제 (옵션)
환경변수로 JSON 저장소를 강제할 수 있습니다.

```powershell
$env:APP_USE_JSON = '1'
php -S 127.0.0.1:8000 -t .
```

`env_APP_USE_JSON` 상태는 `/api/ping.php`에서 확인 가능합니다.

## 컨테이너 배포 (권장)
Apache+PHP 컨테이너로 쉽게 배포할 수 있습니다.

### 필요 도구
- Docker Desktop

### 빌드 및 실행
```powershell
cd "c:\Users\송민규\Desktop\SEPNPHP"
docker compose up -d --build
```

접속: http://localhost:8000

### 구성
- Dockerfile: `php:8.2-apache` 기반, `pdo_sqlite/sqlite3` 확장 설치
- `APP_USE_JSON=0` (컨테이너에서는 SQLite 사용)
- 볼륨: `./data:/var/www/html/data` (데이터 영속화)

## 파일 구조
- index.html: 홈페이지
- assets/css/styles.css: 기본 스타일
- assets/js/main.js: 캐러셀 초기화, 실시간 목록 렌더링, 네비 토글
- assets/img/logo.svg: 심플 로고
- pages/*.html: 네비게이션 대상 서브 페이지(회사소개/제품/견적/문의 게시판)
- api/submit_quote.php: 견적 등록 API(JSON 또는 폼)
- api/quotes_list.php: 견적 목록 JSON 반환(폴백용)
- api/quotes_sse.php: 견적 목록 SSE 스트림(실시간)
- data/quotes.json: 견적 데이터 저장 파일

## 견적 등록 방법
1. 상단 메뉴에서 "견적문의" 페이지로 이동
2. 성함/이메일/제품명 등 필수 항목 입력 후 등록
3. 홈페이지 우측 "실시간 견적문의" 카드 목록에서 자동 반영됨

## 이미지 라이선스
데모 이미지는 placehold.co(플레이스홀더)이며 상업적 제약 없이 교체 가능합니다.

## 배포 시 참고
- quotes.json은 간단한 파일 기반 저장입니다. 실제 운영 환경에서는 데이터베이스(MySQL 등)로 대체하세요.
- SSE는 프록시/로드밸런서 환경에서 타임아웃 설정을 확인하세요.
