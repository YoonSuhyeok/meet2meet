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

const recommendedSlots = [
    { label: "05/11 19:00" },
    { label: "05/10 19:00" },
    { label: "05/11 20:00" },
    { label: "05/12 18:00" },
    { label: "05/10 18:00" },
] satisfies MeetingDetailAtlasProps["recommendedSlots"];

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
            "Host가 상세 화면에서 현황을 확인하고, 공유/잠금/후속 운영 액션을 검토하는 기본 상태.",
        goal: "Host 전용 CTA와 집계형 히트맵이 함께 보이고, 드래그 확정 진입점이 자연스러운지 확인한다.",
        previewMode: "interactive",
        stats: baseStats,
        voteState: "open",
        decisionState: "none",
        showHostControls: true,
        recommendedSlots,
        visibleElements: [
            "미팅 제목, 상태 배지, 장소/시간 정보",
            "후보 날짜/응답 참여자/최고 겹침 슬롯 카드",
            "히트맵과 Host 드래그 확정 영역",
            "회고 작성, 공유 링크 복사, 투표 마감 버튼",
            "미팅 알림 토글",
        ],
        hiddenElements: [
            "잠정 확정안 안내 배너",
            "게스트 participantCode 안내",
            "로그인 유도 CTA",
        ],
        notes: [
            "Host는 읽기만 하지 않고 운영 액션을 함께 본다.",
            "Host 결정은 별도 버튼보다 집계된 드래그판 위 직접 선택이 더 명확하다.",
        ],
        actions: [
            { label: "공유 링크 복사", tone: "secondary", state: "enabled" },
            { label: "투표 마감", tone: "warning", state: "enabled" },
        ],
    },
};

export const Branch02HostDragSelecting: Story = {
    name: "Branch-02 Host Drag Selecting",
    args: {
        branchId: "Branch-02 / FO-03-002A",
        title: "Host가 드래그판 위에서 블록 선택 중",
        route: "/meeting/{id}",
        actor: "로그인 Host",
        statusLabel: "드래그 선택 중",
        statusTone: "neutral",
        summary:
            "이미 쌓인 Participant 선택 히트맵 위에서 Host가 직접 드래그로 확정 블록을 고르는 중간 상태.",
        goal: "Host가 추천 버튼 없이도 히트맵 위에서 바로 의사결정할 수 있는지 시각화한다.",
        previewMode: "interactive",
        stats: baseStats,
        voteState: "open",
        decisionState: "none",
        showHostControls: true,
        hostSelectionState: "dragging",
        dragPreviewBlockLabels: ["05/11 19:00", "05/11 20:00"],
        recommendedSlots: [{ label: "05/11 19:00" }, { label: "05/11 20:00" }],
        hostDecisionHelpText:
            "Host가 히트맵 위에서 직접 드래그해 2개 블록을 프리뷰 중입니다. 손을 떼면 잠정 확정안으로 저장됩니다.",
        visibleElements: [
            "Participant 선택이 반영된 히트맵",
            "Host 드래그 프리뷰 블록",
            "드래그 프리뷰 상태 배지",
            "프리뷰된 블록 요약 칩",
        ],
        hiddenElements: [
            "추천 Slot 버튼형 선택 UI",
            "즉시 확정 완료 배너",
            "Participant 제출 비활성화",
        ],
        notes: [
            "Host 선택은 별도 리스트가 아니라 기존 드래그판 위에서 이어져야 이해가 쉽다.",
        ],
        actions: [
            { label: "드래그 선택 취소", tone: "secondary", state: "enabled" },
            { label: "잠정 확정안 저장", tone: "primary", state: "enabled" },
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
        voteState: "open",
        decisionState: "none",
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
            "투표 잠금/재오픈 버튼",
            "잠정 확정안 배너",
        ],
        notes: [
            "게스트 경로는 투표와 로그인 연동 CTA에 집중한다.",
            "호스트 전용 정보는 숨기거나 최소화한다.",
        ],
        actions: baseActions,
    },
};

export const Branch03HostTentativeSelection: Story = {
    name: "Branch-03 Host Tentative Selection",
    args: {
        branchId: "Branch-03 / FO-03-003",
        title: "잠정 확정안 지정 후 투표 유지",
        route: "/meeting/{id}",
        actor: "로그인 Host",
        statusLabel: "잠정 확정안 있음",
        statusTone: "success",
        summary:
            "Host가 드래그판 위에서 고른 블록 묶음을 잠정 확정안으로 저장했지만, Participant 투표는 계속 열려 있는 상태.",
        goal: "Finalize와 Lock이 분리된 뒤 Host가 어떤 상태를 보는지 시각화한다.",
        previewMode: "interactive",
        stats: baseStats,
        voteState: "open",
        decisionState: "tentative",
        decisionBlockLabels: ["05/11 19:00", "05/11 20:00"],
        hostSelectionState: "selected",
        decisionNotice: {
            title: "잠정 확정안 블록이 지정되었습니다.",
            body: "아직 투표는 열려 있습니다. Participant는 다른 Slot에도 계속 응답을 제출하거나 수정할 수 있고, Host는 여러 블록을 묶어 잠정 확정안으로 둘 수 있습니다.",
            tone: "success",
        },
        showHostControls: true,
        recommendedSlots: recommendedSlots.map((slot) => ({
            ...slot,
            isSelected:
                slot.label === "05/11 19:00" || slot.label === "05/11 20:00",
        })),
        notificationLabel: "잠금 전에는 조용한 상태 변경만 반영",
        visibleElements: [
            "투표 진행 중 배지와 잠정 확정안 블록 배지",
            "잠정 확정안 블록 안내 배너",
            "드래그로 저장된 블록 묶음 강조",
            "잠금과 별개인 Host 운영 CTA",
        ],
        hiddenElements: [
            "확정 즉시 투표 차단 안내",
            "읽기 전용 전환",
            "Participant 제출 비활성 상태",
        ],
        notes: [
            "Host 일정 확정안은 단일 블록이 아니라 연속/복수 블록 묶음일 수 있다.",
            "Host는 이후 Lock을 별도 액션으로 수행한다.",
        ],
        actions: [
            { label: "공유 링크 복사", tone: "secondary", state: "enabled" },
            { label: "투표 마감", tone: "warning", state: "enabled" },
        ],
    },
};

export const Branch03ParticipantTentativeOpen: Story = {
    name: "Branch-03 Participant With Tentative Selection",
    args: {
        branchId: "Branch-03 / FO-03-004",
        title: "Participant가 잠정 확정안을 보며 계속 투표",
        route: "/m/{shortId}",
        actor: "Participant",
        statusLabel: "잠정 확정안 공유 중",
        statusTone: "neutral",
        summary:
            "Participant가 Host의 잠정 확정안을 보더라도, Lock 전에는 기존처럼 Slot을 계속 제출/수정할 수 있는 상태.",
        goal: "잠정 확정안 노출과 투표 가능 상태가 동시에 성립하는지 확인한다.",
        previewMode: "interactive",
        voteState: "open",
        decisionState: "tentative",
        decisionBlockLabels: ["05/11 19:00", "05/11 20:00"],
        decisionNotice: {
            title: "호스트의 잠정 확정안 블록이 있습니다.",
            body: "참고용 안내이며 아직 일정은 잠기지 않았습니다. 호스트는 여러 블록을 함께 제안할 수 있고, Participant는 원하는 Slot으로 계속 응답을 수정할 수 있습니다.",
            tone: "neutral",
        },
        showSelectionSummary: true,
        visibleElements: [
            "잠정 확정안 블록 배너",
            "드래그 가능한 시간 선택 그리드",
            "활성화된 응답 제출 버튼",
            "기존 선택 수 요약",
        ],
        hiddenElements: [
            "호스트 운영 버튼",
            "읽기 전용 차단 문구",
            "회고 보기 CTA 자동 노출",
        ],
        notes: [
            "Participant는 잠정 확정안을 일정 안내로 보되, 수정 권한은 그대로 유지한다.",
            "확정이라는 단어만 단독으로 쓰면 오해가 생긴다.",
        ],
        actions: baseActions,
    },
};

export const Branch04BetterOptionWarning: Story = {
    name: "Branch-04 Better Option Warning",
    args: {
        branchId: "Branch-04 / FO-03-005",
        title: "더 좋은 대안 발생 경고",
        route: "/meeting/{id}",
        actor: "로그인 Host",
        statusLabel: "재검토 필요",
        statusTone: "warning",
        summary:
            "기존 잠정 확정안 블록 묶음은 유지하되, 이후 투표 결과상 더 높은 합의도 블록 조합이 생긴 경우 Host에게 재검토 경고를 보여주는 상태.",
        goal: "자동 교체 없이도 Host가 더 좋은 대안을 놓치지 않게 만든다.",
        previewMode: "interactive",
        stats: baseStats,
        voteState: "open",
        decisionState: "tentative",
        decisionBlockLabels: ["05/11 19:00", "05/11 20:00"],
        hostSelectionState: "selected",
        decisionNotice: {
            title: "잠정 확정안 블록이 지정되었습니다.",
            body: "현재 블록 묶음은 유지되지만, 이후 투표 결과를 계속 확인할 수 있습니다.",
            tone: "success",
        },
        secondaryNotice: {
            title: "더 좋은 대안 블록 조합이 생겼습니다.",
            body: "05/10 19:00, 05/10 18:00 조합이 더 높은 합의도를 보여 현재 잠정 확정안 블록보다 더 좋은 대안이 되었습니다.",
            tone: "warning",
        },
        showHostControls: true,
        recommendedSlots: [
            { label: "05/10 19:00" },
            { label: "05/11 19:00", isSelected: true },
            { label: "05/11 20:00", isSelected: true },
            { label: "05/12 18:00" },
            { label: "05/10 18:00" },
        ],
        hostDecisionHelpText:
            "잠정 확정안 블록 묶음은 자동 변경되지 않습니다. 더 높은 합의도 조합이 생기면 Host가 직접 변경 여부를 판단합니다.",
        visibleElements: [
            "잠정 확정안 블록 배너",
            "더 높은 합의도 대안 경고",
            "선택된 블록 묶음과 더 좋은 대안의 공존",
            "여전히 열린 투표 상태",
        ],
        hiddenElements: [
            "자동 잠정 확정안 교체",
            "즉시 잠금 전환",
            "Participant 제출 비활성화",
        ],
        notes: [
            "경고는 의사결정 보조 역할만 해야 하며 블록 묶음을 자동으로 바꾸면 안 된다.",
            "Top 5 정렬 규칙이 경고 해석의 전제가 된다.",
        ],
        actions: [
            { label: "잠정 확정안 변경", tone: "secondary", state: "enabled" },
            { label: "투표 마감", tone: "warning", state: "enabled" },
        ],
    },
};

export const Branch05LockedAfterFinalize: Story = {
    name: "Branch-05 Locked After Finalize",
    args: {
        branchId: "Branch-05 / FO-03-006",
        title: "잠금 후 최종 일정 고정",
        route: "/meeting/{id}, /m/{shortId}",
        actor: "Host 또는 Participant",
        statusLabel: "잠금 완료",
        statusTone: "warning",
        summary:
            "Host가 Lock을 수행해 투표가 닫히고, 드래그로 고른 블록 묶음이 실제 일정으로 고정된 상태.",
        goal: "잠정 확정안 단계와 실제 잠금 이후 단계를 분명히 구분한다.",
        previewMode: "interactive",
        voteState: "locked",
        decisionState: "final",
        decisionBlockLabels: ["05/11 19:00", "05/11 20:00"],
        hostSelectionState: "selected",
        decisionNotice: {
            title: "일정 블록이 잠겼습니다.",
            body: "이제 더 이상 Slot 투표를 제출하거나 수정할 수 없습니다. Host가 고른 여러 블록이 실제 일정으로 고정되며, 후속 알림과 AttendanceAck는 이 시점부터 시작됩니다.",
            tone: "warning",
        },
        notificationLabel: "잠금 이후 일정 알림 발송",
        visibleElements: [
            "투표 잠김 배지와 확정 블록 배지",
            "읽기 전용 히트맵",
            "확정 블록 강조",
            "잠금 이후 후속 플로우 안내",
        ],
        hiddenElements: [
            "활성화된 응답 제출 버튼",
            "드래그 선택 인터랙션",
            "잠금 전 조용한 상태 안내",
        ],
        notes: [
            "강한 알림, AttendanceAck, 후속 플로우는 잠금 이후에만 시작한다.",
            "잠금 해제 시에도 드래그로 고른 확정안 블록은 유지된다는 전제가 뒤이어 필요하다.",
        ],
        actions: [
            { label: "내 선택 초기화", tone: "secondary", state: "disabled" },
            { label: "응답 제출", tone: "primary", state: "disabled" },
        ],
    },
};

export const Branch06ClosedWithoutDecisionBlocks: Story = {
    name: "Branch-06 Locked Without Decision Blocks",
    args: {
        branchId: "Branch-06 / FO-03-007",
        title: "잠금만 먼저 된 상태",
        route: "/meeting/{id}, /m/{shortId}",
        actor: "Participant",
        statusLabel: "잠김",
        statusTone: "warning",
        summary:
            "운영상 투표는 닫혔지만 아직 확정안 블록을 비워 둔 상태. 잠금과 확정안 블록이 별개라는 점을 확인하기 위한 예외 시나리오.",
        goal: "Lock과 확정안 블록이 서로 독립된 상태값임을 스토리에서 분리해 본다.",
        previewMode: "interactive",
        voteState: "locked",
        decisionState: "none",
        decisionNotice: {
            title: "이 미팅은 현재 잠겨 있습니다.",
            body: "투표는 닫혔지만 Host가 아직 확정안 블록을 공개하지 않았습니다.",
            tone: "warning",
        },
        showSelectionSummary: true,
        visibleElements: [
            "투표 잠김 배지",
            "확정안 블록 없이 닫힌 상태 안내",
            "읽기 전용 히트맵",
        ],
        hiddenElements: [
            "확정 슬롯 강조",
            "활성 제출 버튼",
            "Host 전용 운영 CTA",
        ],
        notes: [
            "실서비스에서 드문 상태일 수 있지만, 상태 모델 분리를 검증하는 데 유용하다.",
        ],
        actions: [
            { label: "내 선택 초기화", tone: "secondary", state: "disabled" },
            { label: "응답 제출", tone: "primary", state: "disabled" },
        ],
    },
};

export const Branch07NotificationRedirect: Story = {
    name: "Branch-07 Notification Redirect",
    args: {
        branchId: "Branch-07 / FO-03-008",
        title: "비로그인 알림 토글 로그인 전이",
        route: "/m/{shortId}",
        actor: "비로그인 Participant",
        statusLabel: "로그인 필요",
        statusTone: "neutral",
        summary:
            "알림 토글을 누르면 곧바로 로그인 전이와 복귀 경로 저장이 일어나야 하는 상태.",
        goal: "알림 설정은 막되, 무반응이 아닌 로그인 유도 흐름으로 연결되는지 확인한다.",
        previewMode: "interactive",
        voteState: "open",
        decisionState: "tentative",
        decisionBlockLabels: ["05/11 19:00", "05/11 20:00"],
        decisionNotice: {
            title: "호스트의 잠정 확정안 블록이 있습니다.",
            body: "로그인 후 이 미팅의 변경과 시작 전 안내를 알림으로 받을 수 있습니다.",
            tone: "neutral",
        },
        showLoginCta: true,
        visibleElements: [
            "공유 화면 핵심 정보",
            "알림 카드와 로그인 필요 힌트",
            "로그인 유도 CTA",
        ],
        hiddenElements: ["알림 설정 완료 상태", "Host 운영 액션"],
        notes: [
            "토글 클릭 이후 post-login redirect가 저장되어야 한다.",
            "잠정 확정안 단계에서는 강한 잠금 알림 문구를 쓰지 않는다.",
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

export const ErrorState: Story = {
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
