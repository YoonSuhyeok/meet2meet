# Meet2Meet 시간 선택 테이블 — 구현 계획서

## 목표

Meet2Meet 스타일의 **드래그 기반 시간 선택 테이블**을 구현합니다.
PC/모바일 모두에서 터치 & 마우스 드래그로 참석 가능 시간을 지정할 수 있습니다.

---

## 아키텍처

```
components/time-grid/
├── index.ts              # barrel export
├── types.ts              # 데이터 모델, 유틸 함수
├── TimeCell.tsx           # 개별 셀 컴포넌트 (시각 상태)
├── TimeGrid.tsx           # 그리드 컨테이너 (이벤트 바인딩)
├── useDragSelect.ts       # 드래그 선택 훅 (Mouse + Touch 통합)
└── TimeGrid.stories.tsx   # Storybook 스토리
```

---

## Phase 2: 컴포넌트 설계 — ✅ 완료

### 2-1. 데이터 모델 (`types.ts`)

```typescript
type SlotKey = string;            // "4/11 (금)-09:00"
type DragMode = "select" | "deselect";

interface TimeGridProps {
  dates: string[];                // 열 헤더
  timeSlots: string[];            // 행 레이블
  selected: Set<SlotKey>;         // 현재 선택
  onSelectionChange: (s: Set<SlotKey>) => void;
}
```

- `makeSlotKey(date, time)` — 슬롯 키 생성
- `generateTimeSlots(startHour, endHour, interval)` — 시간 목록 생성

### 2-2. TimeGrid 컴포넌트 (`TimeGrid.tsx`)

- **CSS Grid** 레이아웃: `4rem + repeat(N, 1fr)`
- 시간 레이블 (좌측 고정) + 날짜 헤더 (상단)
- 모든 이벤트 핸들러를 그리드 컨테이너에 위임 (이벤트 버블링)

### 2-3. TimeCell 컴포넌트 (`TimeCell.tsx`)

- `data-slot` 속성으로 `elementFromPoint()` 기반 셀 탐색 지원
- 3가지 시각 상태: 미선택 / 선택됨 / 드래그 프리뷰
- Tailwind 기반 스타일, shadcn 테마 토큰 활용

---

## Phase 3: 드래그 선택 로직 — ✅ 완료

### `useDragSelect` 훅 동작 흐름

```
[mousedown / touchstart]
    │
    ├─ elementFromPoint(x, y) → 슬롯 키 획득
    ├─ 해당 셀의 현재 상태 확인 → DragMode 결정
    │   ├─ 이미 선택 → "deselect" 모드
    │   └─ 미선택   → "select" 모드
    └─ dragState 초기화

[mousemove / touchmove]
    │
    ├─ elementFromPoint(x, y) → 현재 셀 판별
    ├─ dragState.slots에 추가
    └─ 시각 프리뷰 업데이트 (getDragPreview)

[mouseup / touchend]
    │
    ├─ dragState.slots의 모든 셀에 mode 적용
    │   ├─ "select"   → selected.add(slot)
    │   └─ "deselect" → selected.delete(slot)
    ├─ onSelectionChange(newSelected) 호출
    └─ dragState 초기화
```

### 핵심 기술 결정

| 문제 | 해결 |
|------|------|
| Touch 이벤트는 최초 터치 엘리먼트에 고정됨 | `Touch.clientX/Y` + `document.elementFromPoint()` 사용 |
| 모바일에서 드래그/스크롤 충돌 | 그리드에 `touch-action: none` CSS 적용 |
| 드래그 중 시각 피드백 | `dragState`를 별도 state로 관리, 종료 시 확정 |
| 성능 (336셀) | ref로 state 관리하여 불필요한 리렌더 최소화 |

---

## Phase 4: Storybook 스토리 — ✅ 완료

| 스토리 | 설명 | 목적 |
|--------|------|------|
| `Default` | 3일 × 09:00~12:00 (18셀) | 기본 렌더링 & 드래그 테스트 |
| `FullWeek` | 7일 × 09:00~21:00 (336셀) | 대량 셀 성능 & 스크롤 테스트 |
| `Mobile` | 7일 × 09:00~18:00 (모바일 뷰포트) | 모바일 터치 & 가로 스크롤 |

---

## 다음 단계 (TODO)

- [ ] 드래그 영역 범위 제한 (시작~끝 사각형 영역만 선택)
- [ ] 선택 결과 요약 UI (참석 가능 시간대 텍스트 표시)
- [ ] 다중 사용자 오버레이 (참석자 수에 따른 색상 그라데이션)
- [ ] 날짜 선택 연동 (DatePicker → TimeGrid dates 동적 변경)
- [ ] 접근성 향상 (키보드 탐색, aria-selected)

---

## 실행 방법

```bash
# Storybook에서 확인
pnpm storybook
# → http://localhost:6006 → Components > TimeGrid

# 개발 서버에서 확인
pnpm dev
```
