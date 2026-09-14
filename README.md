# 🏢 스마트 회의실 예약 시스템 (RoomBooker)

Node.js (Express) 및 PostgreSQL 기반의 사내 회의실 예약 관리 웹 애플리케이션입니다.
회의실 현황 타임테이블, 실시간 예약 등록 및 중복 방지, 예약 취소, 회의실 관리 기능을 직관적인 모던 웹 UI로 제공합니다.

---

## 🌟 주요 기능

1. **회의실 현황 타임테이블 & 목록 뷰**
   - 08:00 ~ 20:00 일간 타임테이블을 통한 시각적인 회의실 예약 현황 확인
   - 날짜별 이동 (오늘 / 이전일 / 다음일 / 캘린더 날짜 선택)
   - 회의실별 필터링 기능
   - 카드/목록 형태의 상세 조회

2. **실시간 회의실 예약 및 엄격한 중복 방지**
   - 회의실, 회의 제목, 예약자명, 날짜, 시작/종료 시간, 메모 입력
   - **PostgreSQL 트랜잭션 및 비관적 락(`FOR UPDATE`) 기반 중복 시간 예약 검증**
   - 이미 예약된 시간대와 겹칠 경우 안내 팝업 및 충돌 정보 제공

3. **내 예약 조회 및 간편 취소**
   - 예약자명 검색을 통해 내가 예약한 내역만 모아보기
   - 간편 예약 취소 (`DELETE /api/reservations/:id`) 기능

4. **새 회의실 등록**
   - 회의실 이름, 수용 인원, 위치, 장비/설명 입력 및 실시간 반영

5. **자동 스키마 초기화 & 시드 데이터**
   - 서버 시작 시 `rooms` 및 `reservations` 테이블 자동 생성 (`initDb`)
   - 기본 회의실 5개 (회의실 A, 회의실 B, 회의실 C, 대회의실, 소회의실) 자동 시드

---

## 🛠 기술 스택

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL (`pg` 클라이언트 라이브러리 사용)
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3, Tailwind CSS CDN, Font Awesome
- **Etc**: CORS, dotenv

---

## 📋 데이터베이스 스키마

### 1. `rooms` (회의실 테이블)
| 필드명 | 타입 | 제약 조건 | 설명 |
|--------|------|-----------|------|
| `id` | SERIAL | PRIMARY KEY | 회의실 고유 ID |
| `name` | VARCHAR(100) | NOT NULL | 회의실 이름 |
| `capacity` | INT | NOT NULL DEFAULT 4 | 수용 가능 인원수 |
| `location` | VARCHAR(100) | NOT NULL | 회의실 위치 |
| `description` | TEXT | | 회의실 설명 및 장비 |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 등록 일시 |

### 2. `reservations` (예약 테이블)
| 필드명 | 타입 | 제약 조건 | 설명 |
|--------|------|-----------|------|
| `id` | SERIAL | PRIMARY KEY | 예약 고유 ID |
| `room_id` | INT | NOT NULL, REFERENCES rooms(id) ON DELETE CASCADE | 예약 회의실 ID |
| `title` | VARCHAR(200) | NOT NULL | 회의 제목/목적 |
| `reserver_name` | VARCHAR(100) | NOT NULL | 예약자 이름 |
| `start_time` | TIMESTAMP | NOT NULL | 시작 일시 |
| `end_time` | TIMESTAMP | NOT NULL | 종료 일시 |
| `memo` | TEXT | | 비고 및 메모 |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 생성 일시 |

---

## 🚀 API 명세

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| `GET` | `/healthz` | 서비스 상태 및 DB 연결 점검 (200 OK) |
| `GET` | `/api/rooms` | 회의실 목록 조회 |
| `POST` | `/api/rooms` | 신규 회의실 생성 |
| `GET` | `/api/reservations` | 예약 목록 조회 (`?date=YYYY-MM-DD`, `&room_id=...` 필터링) |
| `POST` | `/api/reservations` | 새 예약 생성 (시간 중복 검증 필수 적용) |
| `DELETE` | `/api/reservations/:id` | 예약 취소 및 삭제 |

---

## ⚙️ 환경변수 설정

루트 디렉터리의 `.env` 파일 또는 시스템 환경변수로 구성할 수 있습니다.

```env
# 서버 포트 (기본값: 3000)
PORT=3000

# PostgreSQL 연결 URL (형식: postgresql://[user]:[password]@[host]:[port]/[database])
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/meeting_rooms

# SSL 연결 사용 여부 (필요 시 true)
DATABASE_SSL=false
```

---

## 💻 로컬 실행 방법

1. **저장소 클론 및 패키지 설치**
   ```bash
   git clone https://github.com/alerundev/meeting-room-reservation.git
   cd meeting-room-reservation
   npm install
   ```

2. **환경변수 설정**
   `.env` 파일에 유효한 `DATABASE_URL`을 지정합니다.

3. **서버 시작**
   ```bash
   npm start
   ```

4. **웹 브라우저 접속**
   [http://localhost:3000](http://localhost:3000) 으로 접속하여 회의실 예약 시스템을 이용합니다.
