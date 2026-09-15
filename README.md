# 회의실 예약시스템 MVP

PostgreSQL을 사용하는 한국어 회의실 예약 웹 애플리케이션입니다.

## 기술 스택

- Node.js 20+
- Express 4
- PostgreSQL (`pg`)
- 서버 렌더링 없이 Express 정적 파일 + 바닐라 JavaScript UI

## 실행

```bash
npm install
DATABASE_URL='postgresql://사용자:비밀번호@호스트:5432/데이터베이스' PORT=3000 npm start
```

서버는 `0.0.0.0`의 `PORT`(기본값 `3000`)에 바인딩합니다. 배포 플랫폼에서는 PostgreSQL 바인딩으로 주입되는 `DATABASE_URL`을 사용하세요. 비밀번호와 연결 문자열은 코드에 포함되어 있지 않습니다.

Docker를 사용하는 경우:

```bash
docker build -t meeting-room-mvp .
docker run --rm -p 3000:3000 -e DATABASE_URL="$DATABASE_URL" meeting-room-mvp
```

## 동작

- 서버 시작 시 `rooms`, `reservations` 테이블과 회의실 기본 3개를 자동 생성합니다.
- 기본 회의실은 이름의 unique 제약 + `ON CONFLICT DO NOTHING`으로 중복 생성하지 않습니다.
- `btree_gist` 기반 PostgreSQL exclusion constraint가 같은 회의실의 겹치는 예약을 차단합니다. 충돌 시 API는 HTTP `409`를 반환합니다.
- 날짜별 예약 조회, 예약 생성, 예약 취소 API를 제공합니다.

## 테스트

```bash
npm test
```

테스트는 예약 입력 검증을 확인합니다. 통합 테스트를 실행하려면 별도의 PostgreSQL 인스턴스가 필요합니다.