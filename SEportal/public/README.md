# sepnp-portal

이 프로젝트는 고객과 사원을 구분하여 보여주는 웹사이트를 구현합니다. 고객은 외부 링크인 [www.sepnp.com](http://www.sepnp.com)으로 연결되는 버튼을 통해 접근할 수 있으며, 사원은 생산 관리 및 재고 관리 기능을 포함한 대시보드에 접근할 수 있습니다.

## 프로젝트 구조

- `src/client/pages/index.tsx`: 홈페이지의 기본 구조를 정의합니다.
- `src/client/pages/customer.tsx`: 고객용 홈페이지로, 고객 버튼 클릭 시 외부 링크로 연결됩니다.
- `src/client/pages/employee.tsx`: 사원용 대시보드로, 생산 및 재고 관리 기능을 포함합니다.
- `src/client/components/Header.tsx`: 웹사이트의 헤더 컴포넌트를 정의합니다.
- `src/client/components/CustomerButton.tsx`: 고객용 버튼 컴포넌트를 정의합니다.
- `src/client/components/EmployeeDashboard.tsx`: 사원용 대시보드의 UI를 정의합니다.
- `src/client/styles/globals.css`: 전역 스타일을 정의합니다.
- `src/server/app.ts`: 서버의 진입점으로, Express 앱을 설정합니다.
- `src/server/routes/auth.ts`: 인증 관련 API 라우트를 정의합니다.
- `src/server/routes/production.ts`: 생산 관리 API 라우트를 정의합니다.
- `src/server/routes/inventory.ts`: 재고 관리 API 라우트를 정의합니다.
- `src/server/controllers/productionController.ts`: 생산 관리 비즈니스 로직을 처리합니다.
- `src/server/controllers/inventoryController.ts`: 재고 관리 비즈니스 로직을 처리합니다.
- `src/shared/models/product.ts`: 제품 모델을 정의합니다.
- `src/shared/models/inventory.ts`: 재고 모델을 정의합니다.
- `src/shared/types/index.ts`: 프로젝트에서 사용되는 타입을 정의합니다.
- `package.json`: npm의 설정 파일입니다.
- `tsconfig.json`: TypeScript의 설정 파일입니다.
- `.env.example`: 환경 변수를 정의하는 예시 파일입니다.

## 설치 및 실행

1. 저장소를 클론합니다.
2. 필요한 패키지를 설치합니다.
   ```
   npm install
   ```
3. 서버를 실행합니다.
   ```
   npm start
   ```

## 기여

기여를 원하시는 분은 이 저장소를 포크한 후, 변경 사항을 커밋하고 풀 리퀘스트를 제출해 주세요.