# Cloudflare 호스팅 가이드

Cloudflare로 도메인을 관리/프록시하거나 Cloudflare Tunnel로 원격 서버 없이도 공개할 수 있습니다.

## 1) Cloudflare DNS + Origin 서버 (권장)
PHP는 Cloudflare Pages에서 직접 실행되지 않습니다. Origin 서버(예: VPS)에서 컨테이너로 PHP를 구동하고, Cloudflare가 프록시합니다.

### 단계
1. Origin 서버 준비 (Ubuntu 등)
2. Docker로 컨테이너 실행 (포트 80 또는 내부 8080)
3. Cloudflare DNS에서 A 레코드를 서버 공인 IP로 설정하고, 프록시(주황색 구름)를 켭니다.
4. Nginx 리버스 프록시 구성: `deploy/nginx.conf` 참고
   - Cloudflare IP를 real_ip로 복원
   - SSE 버퍼링을 비활성화
5. HTTPS 발급: `certbot --nginx -d yourdomain.com`

## 2) Cloudflare Tunnel (서버·포트포워딩 없이 공개)
Origin 서버가 없거나, 내부망 서비스(로컬 PC/랩탑)를 안전하게 외부에 공개할 수 있습니다.

### 빠른 테스트
```bash
cloudflared tunnel --url http://localhost:80
```
출력된 Cloudflare URL을 공유하면 즉시 외부 접근이 가능합니다.

### 정식 구성 (도메인 연결)
```bash
# 로그인 및 인증
cloudflared tunnel login

# 터널 생성
autotunnel_name=sepnphp
cloudflared tunnel create $autotunnel_name

# 도메인 호스트명 라우팅 (예: app.example.com)
cloudflared tunnel route dns $autotunnel_name app.example.com

# 터널 실행 (Origin이 127.0.0.1:8080에서 서비스 가정)
cloudflared tunnel run $autotunnel_name --url http://127.0.0.1:8080
```

Systemd 서비스로 영구 실행하려면 Cloudflare 공식 문서를 참고하세요.

## SSE 동작 팁
- SSE 응답 헤더에 `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no` 설정
- Nginx에서 `proxy_buffering off`로 프록시 버퍼링 끄기
- Cloudflare에서 자동 변환/압축 간섭을 최소화하기 위해 no-transform 권장

## 보안/최적화
- WAF/Rate Limiting: Cloudflare에서 요청 제한, 봇 방어 설정
- 캐시: 정적 자산만 캐시 (HTML/PHP API는 캐시 금지)
- 원래 IP: `CF-Connecting-IP`를 사용하여 클라이언트 IP 복원
- HTTPS: Cloudflare Full(Strict) 모드 권장, Origin에 Let’s Encrypt 구성
