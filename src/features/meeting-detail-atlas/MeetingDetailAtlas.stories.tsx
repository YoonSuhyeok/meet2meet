import type { Meta, StoryObj } from "@storybook/react-vite";
import {
    MeetingDetailAtlas,
    type MeetingDetailAtlasProps,
} from "./MeetingDetailAtlas";

const baseStats = [
    { label: "후보 날짜", value: "3일" },
    { label: "응답 참여자", value: "8명" },
    { label: "최고 겹침 슬롯", value: "4명" },
] satisfies MeetingDetailAtlasProps["stats"];

const baseActions = [
    { label: "내 선택 초기화", tone: "secondary", state: "enabled" },
    { label: "응답 제출", tone: "primary", state: "enabled" },
] satisfies MeetingDetailAtlasProps["actions"];

const meta: Meta<typeof MeetingDetailAtlas> = {
    title: "Atlas/Meeting Detail",
    component: MeetingDetailAtlas,
    parameters: {
        layout: "fullscreen",
    },
};

export default meta;

type Story = StoryObj<typeof MeetingDetailAtlas>;

export const Branch01HostDefault: Story = {
    name: "Branch-01 Host Default",
    args: {
        branchId: "Branch-01 / FO-03-001",
        title: "Host 기본 상세 조회",
        route: "/meeting/{id}",
        actor: "로그인 Host",
        statusLabel: "진행 중",
        statusTone: "success",
        summary:
            "Host가 상세 화면에서 현황을 확인하고, 공유/마감/후속 운영 액션을 검토하는 상태.",
        goal: "Host 전용 CTA와 집계형 히트맵이 함께 보이는지 확인한다.",
        previewMode: "interactive",
        stats: baseStats,
        showHostControls: true,
        visibleElements: [
            "미팅 제목, 상태 배지, 장소/시간 정보",
            "후보 날짜/응답 참여자/최고 겹침 슬롯 카드",
            "히트맵과 추천 시간대 판단용 집계 정보",
            "회고 작성, 공유 링크 복사, 투표 마감 버튼",
            "미팅 알림 토글",
        ],
        hiddenElements: [
            "게스트 participantCode 안내",
            "로그인 유도 CTA",
            "확정/마감 차단 메시지",
        ],
        notes: [
            "Host는 읽기만 하지 않고 운영 액션을 함께 본다.",
            "미응답 인원 수가 CTA 주변에 보여야 후속 조치 판단이 쉽다.",
        ],
        actions: [
            { label: "공유 링크 복사", tone: "secondary", state: "enabled" },
            { label: "투표 마감", tone: "warning", state: "enabled" },
        ],
    },
};

export const Branch02GuestVote: Story = {
    name: "Branch-02 Guest Vote",
    args: {
        branchId: "Branch-02 / FO-03-002",
        title: "Guest 공유 화면 투표",
        route: "/m/{shortId}",
        actor: "비로그인 Participant",
        statusLabel: "응답 가능",
        statusTone: "success",
        summary:
            "공유 링크 진입 후 빠르게 시간 선택과 제출을 할 수 있어야 하는 상태.",
        goal: "로그인 없이 투표 가능하고, 선택/제출 중심 화면인지 확인한다.",
        previewMode: "interactive",
        showLoginCta: true,
        showSelectionSummary: true,
        visibleElements: [
            "간소화된 제목/일정 요약",
            "드래그 가능한 시간 선택 그리드",
            "선택 수 요약과 마지막 저장 메시지",
            "로그인해서 내 응답 연동 CTA",
            "응답 제출 버튼",
        ],
        hiddenElements: [
            "호스트 운영 버튼",
            "투표 마감/재오픈 버튼",
            "회고 작성 버튼",
        ],
        notes: [
            "게스트 경로는 투표와 로그인 연동 CTA에 집중한다.",
            "호스트 전용 정보는 숨기거나 최소화한다.",
        ],
        actions: baseActions,
    },
};

export const Branch03Finalized: Story = {
    name: "Branch-03 Finalized",
    args: {
        branchId: "Branch-03 / FO-03-003",
        title: "확정 상태 제출 차단",
        route: "/meeting/{id}, /m/{shortId}",
        actor: "Host 또는 Participant",
        statusLabel: "확정됨",
        statusTone: "warning",
        summary:
            "미팅이 확정되어 더 이상 투표를 수정할 수 없고, 확정된 슬롯만 강조해서 보여주는 상태.",
        goal: "사용자가 왜 수정할 수 없는지 즉시 이해할 수 있어야 한다.",
        previewMode: "interactive",
        showNotificationCard: true,
        lockedMessage:
            "호스트가 일정을 확정했습니다. 더 이상 투표를 제출하거나 수정할 수 없습니다.",
        finalSlotLabel: "05/11 19:00",
        visibleElements: [
            "확정 배지와 차단 안내 메시지",
            "읽기 전용 히트맵",
            "확정 슬롯 강조",
            "비파괴 액션(공유, 회고 보기 등)",
        ],
        hiddenElements: [
            "선택 변경 인터랙션",
            "활성화된 응답 제출 버튼",
            "저장 성공 토스트",
        ],
        notes: [
            "확정 상태는 단순 disabled보다 차단 이유 메시지가 중요하다.",
            "확정 슬롯은 시각적으로 가장 먼저 보여야 한다.",
        ],
        actions: [
            { label: "내 선택 초기화", tone: "secondary", state: "disabled" },
            { label: "응답 제출", tone: "primary", state: "disabled" },
        ],
    },
};

export const Branch03Closed: Story = {
    name: "Branch-03 Closed",
    args: {
        branchId: "Branch-03 / FO-03-003",
        title: "마감 상태 제출 차단",
        route: "/meeting/{id}, /m/{shortId}",
        actor: "Participant",
        statusLabel: "마감됨",
        statusTone: "warning",
        summary:
            "확정은 아니지만 응답 기간이 닫혀서 제출과 수정이 모두 차단된 상태.",
        goal: "마감과 확정을 구분하되, 동일하게 수정이 막힌다는 점을 드러낸다.",
        previewMode: "interactive",
        showSelectionSummary: true,
        lockedMessage:
            "이 미팅은 현재 마감 상태입니다. 투표를 제출하거나 수정할 수 없습니다.",
        visibleElements: [
            "마감 배지와 차단 문구",
            "읽기 전용 히트맵",
            "기존 선택 결과 요약",
        ],
        hiddenElements: [
            "드래그 선택 인터랙션",
            "활성 제출 버튼",
            "Host 전용 마감 관리 CTA",
        ],
        notes: [
            "확정이 아니므로 최종 슬롯 강조는 없어도 된다.",
            "마감 사유는 문구로 분명하게 분리한다.",
        ],
        actions: [
            { label: "내 선택 초기화", tone: "secondary", state: "disabled" },
            { label: "응답 제출", tone: "primary", state: "disabled" },
        ],
    },
};

export const Branch04NotificationRedirect: Story = {
    name: "Branch-04 Notification Redirect",
    args: {
        branchId: "Branch-04 / FO-03-004",
        title: "비로그인 알림 토글 로그인 전이",
        route: "/m/{shortId}",
        actor: "비로그인 Participant",
        statusLabel: "로그인 필요",
        statusTone: "neutral",
        summary:
            "알림 토글을 누르면 곧바로 로그인 전이와 복귀 경로 저장이 일어나야 하는 상태.",
        goal: "알림 설정은 막되, 무반응이 아닌 로그인 유도 흐름으로 연결되는지 확인한다.",
        previewMode: "interactive",
        showLoginCta: true,
        visibleElements: [
            "공유 화면 핵심 정보",
            "알림 카드와 로그인 필요 힌트",
            "로그인 유도 CTA",
        ],
        hiddenElements: ["알림 설정 완료 상태", "Host 운영 액션"],
        notes: [
            "토글 클릭 이후 post-login redirect가 저장되어야 한다.",
            "무반응처럼 보이면 안 된다.",
        ],
        actions: [{ label: "알림 받기", tone: "secondary", state: "disabled" }],
    },
};

export const Loading: Story = {
    args: {
        branchId: "Branch-00",
        title: "로딩 상태",
        route: "/meeting/{id}",
        actor: "공통",
        statusLabel: "Loading",
        statusTone: "neutral",
        summary: "상세 데이터를 아직 가져오는 중인 상태.",
        goal: "실데이터 대신 스켈레톤이 안정적으로 보이는지 확인한다.",
        previewMode: "loading",
        visibleElements: ["스켈레톤 블록", "레이아웃 여백 유지"],
        hiddenElements: ["실제 CTA", "오류 메시지", "실데이터"],
        notes: ["로딩 중에도 레이아웃 점프가 크지 않아야 한다."],
        actions: [],
    },
};

export const Error: Story = {
    args: {
        branchId: "Branch-00",
        title: "에러 상태",
        route: "/meeting/{id}",
        actor: "공통",
        statusLabel: "Error",
        statusTone: "danger",
        summary: "잘못된 링크이거나 상세 조회에 실패한 상태.",
        goal: "에러 메시지만 명확히 보여주고 오해를 줄인다.",
        previewMode: "error",
        errorMessage: "유효하지 않은 공유 링크입니다.",
        visibleElements: ["명확한 오류 배너"],
        hiddenElements: ["실제 히트맵", "제출 액션", "알림 토글"],
        notes: [
            "재시도나 복귀 CTA가 필요해지면 이 스토리를 기준으로 추가한다.",
        ],
        actions: [],
    },
};

export const MobileGuestVote: Story = {
    name: "Branch-02 Guest Vote Mobile",
    args: {
        ...Branch02GuestVote.args,
    },
    globals: {
        viewport: {
            value: "mobile",
            isRotated: false,
        },
    },
};
