# 서버 배포 가이드 (SEPNPHP)

이 문서는 프로젝트를 인터넷에서 공개 호스팅하는 방법을 단계별로 설명합니다.

## 개요
- 컨테이너 이미지: GitHub Actions가 `ghcr.io/<owner>/sepnphp:latest`로 푸시
- 데이터 영속화: 컨테이너 내부 `/var/www/html/data`를 호스트 디렉터리와 마운트
- 기본 DB 모드: SQLite (`APP_USE_JSON=0`)

> 참고: GHCR 패키지 공개 여부를 확인하세요. 리포지토리 공개이면 자동 공개인 경우가 많으나, 패키지 설정에서 Public으로 바꿔야 외부 서버에서 `docker pull`이 가능합니다.

---

## 옵션 A — 리눅스 서버(빠른 배포)
서버에 Docker만 있으면 바로 실행할 수 있습니다.

### 준비
- 서버(예: Ubuntu 22.04 LTS) 공인 IP
- Docker 설치

```bash
# Ubuntu 예시 (root 또는 sudo)
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
# 재로그인 필요
```

### 컨테이너 실행
```bash
# 데이터 디렉터리 준비
sudo mkdir -p /srv/sepnphp/data
sudo chown -R $(id -un):$(id -gn) /srv/sepnphp

# 이미지 가져오기 (소유자명은 소문자로 쓰는 걸 권장)
docker pull ghcr.io/myeongsupworkspace/sepnphp:latest

# 포트 80으로 서비스 시작 (외부 접속 허용)
docker run -d \
  --name sepnphp \
  -p 80:80 \
  -e APP_USE_JSON=0 \
  -v /srv/sepnphp/data:/var/www/html/data \
  ghcr.io/myeongsupworkspace/sepnphp:latest

# 헬스 체크
curl -s http://localhost/api/ping.php
```

- 접속: `http://<서버IP>/`
- 데이터: `/srv/sepnphp/data`에 저장됨 (`app.db`, `users.json` 등)

### 업데이트(배포 반영)
```bash
docker pull ghcr.io/myeongsupworkspace/sepnphp:latest
docker stop sepnphp && docker rm sepnphp
# 위의 run 명령으로 재시작
```

---

## 옵션 B — 리눅스 서버 + Nginx(HTTPS)
도메인과 HTTPS를 사용하려면 리버스 프록시(Nginx) 구성과 인증서 발급을 추가합니다.

### 컨테이너를 로컬 포트로 바인딩
```bash
docker run -d \
  --name sepnphp \
  -p 127.0.0.1:8080:80 \
  -e APP_USE_JSON=0 \
  -v /srv/sepnphp/data:/var/www/html/data \
  ghcr.io/myeongsupworkspace/sepnphp:latest
```

### Nginx 설정
샘플 설정: `deploy/nginx.conf` 참고(프로젝트에 포함).
- 서버에 복사: `/etc/nginx/sites-available/sepnphp.conf`
- 심볼릭 링크: `/etc/nginx/sites-enabled/sepnphp.conf`
- 테스트/재시작:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

#### Cloudflare 프록시 사용 시
- DNS에서 A 레코드를 Origin IP로 설정 후 프록시(주황색 구름) 활성화
- Nginx에 `real_ip_header CF-Connecting-IP`와 Cloudflare IP 대역을 `set_real_ip_from`으로 등록하여 실제 클라이언트 IP 복원
- SSE 엔드포인트(`/api/quotes_sse.php`)는 `proxy_buffering off`와 `X-Accel-Buffering no` 헤더를 적용 (샘플 설정 포함)

### 도메인 + HTTPS 발급(Let's Encrypt)
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com -d www.example.com
```

> `example.com`을 실제 도메인으로 교체하세요. 발급 후 자동으로 HTTPS 설정이 적용됩니다.

### systemd로 컨테이너 자동 실행(선택)
샘플 유닛 파일: `deploy/sepnphp.service` 참고.
```bash
sudo cp deploy/sepnphp.service /etc/systemd/system/sepnphp.service
sudo systemctl daemon-reload
sudo systemctl enable --now sepnphp
```

---

## 옵션 C — Windows PC에서 빠르게 공개
- Docker Desktop 설치
- Windows 방화벽 인바운드 규칙에서 `TCP 80` 허용
- 공유기 포트포워딩(공인IP → 내부 80) 설정

```powershell
# 프로젝트 클론 후
cd C:\Users\송민규\Desktop\SEPNPHP
# compose로 실행 (이미 로컬 빌드/실행도 가능)
docker compose up -d --build
# 또는 GHCR 이미지로 실행
docker run -d `
  --name sepnphp `
  -p 80:80 `
  -e APP_USE_JSON=0 `
  -v C:\sepnphp\data:/var/www/html/data `
  ghcr.io/myeongsupworkspace/sepnphp:latest
```

---

## 옵션 D — 터널로 즉시 외부 공개(고정IP 없이)
고정 IP/포트포워딩 없이도 빠르게 외부 공유가 가능합니다.

### Cloudflare Tunnel(권장)
```bash
# 서버에서 (로컬/윈도/리눅스 어디든 가능)
cloudflared tunnel --url http://localhost:80
```
출력되는 URL을 공유하면 외부에서 접근 가능합니다.

### ngrok(대안)
```bash
ngrok http 80
```

### Cloudflare로 정식 도메인 연결 (Tunnel)
자세한 단계는 [deploy/cloudflare.md](deploy/cloudflare.md)를 참고하세요.

---

## 운영 팁
- 모드: 컨테이너 기본은 SQLite(`APP_USE_JSON=0`). 환경 제약 시 `APP_USE_JSON=1`로 JSON 폴백 사용
- 헬스 체크: `/api/ping.php`로 상태와 환경변수 확인
- 보안: 관리자 계정은 `sepnp/0536`로 고정(코드 강제). 운영 환경에서 비밀번호 변경 고려
- 로그/모니터링: Nginx 로그, 컨테이너 로그(`docker logs -f sepnphp`)
- 백업: `/srv/sepnphp/data` 디렉터리 주기적 백업

### Cloudflare 특이점
- PHP는 Cloudflare Pages에서 직접 실행되지 않으므로 Origin 또는 Tunnel을 사용합니다.
- Cloudflare 프록시 환경에서 SSE는 버퍼링을 끄고 `no-transform` 헤더를 설정했을 때 안정적으로 동작합니다.

## 문제 해결
- GHCR 접근 권한: 패키지 Public 설정 확인
- 포트 충돌: 다른 서비스가 80 사용 중이면 Nginx 프록시 구성 또는 포트 변경
- 권한 문제: 호스트 데이터 디렉터리 권한을 컨테이너에서 읽기/쓰기 가능하게 조정
