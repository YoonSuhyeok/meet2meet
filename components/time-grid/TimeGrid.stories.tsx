import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { TimeGrid } from "./TimeGrid";
import { generateTimeSlots } from "./types";
import type { SlotKey } from "./types";

const meta: Meta<typeof TimeGrid> = {
  title: "Components/TimeGrid",
  component: TimeGrid,
  parameters: {
    layout: "centered",
  },
};

export default meta;

/** 상태를 관리하는 래퍼 (Storybook에서 인터랙션 테스트용) */
function TimeGridWithState({
  dates,
  timeSlots,
}: {
  dates: string[];
  timeSlots: string[];
}) {
  const [selected, setSelected] = useState<Set<SlotKey>>(new Set());

  return (
    <div className="space-y-4">
      <TimeGrid
        dates={dates}
        timeSlots={timeSlots}
        selected={selected}
        onSelectionChange={setSelected}
      />
      <p className="text-sm text-muted-foreground">
        선택된 슬롯: {selected.size}개
      </p>
    </div>
  );
}

/** 기본 — 빈 그리드 (3일 × 09:00~12:00) */
export const Default: StoryObj = {
  render: () => (
    <TimeGridWithState
      dates={["4/11 (금)", "4/12 (토)", "4/13 (일)"]}
      timeSlots={generateTimeSlots(9, 12)}
    />
  ),
};

/** 풀사이즈 — 7일 × 09:00~21:00 (336셀) */
export const FullWeek: StoryObj = {
  render: () => (
    <TimeGridWithState
      dates={[
        "4/7 (월)", "4/8 (화)", "4/9 (수)", "4/10 (목)",
        "4/11 (금)", "4/12 (토)", "4/13 (일)",
      ]}
      timeSlots={generateTimeSlots(9, 21)}
    />
  ),
};

/** 모바일 뷰포트 — 좁은 화면에서 가로 스크롤 확인 */
export const Mobile: StoryObj = {
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
  render: () => (
    <TimeGridWithState
      dates={[
        "4/7 (월)", "4/8 (화)", "4/9 (수)", "4/10 (목)",
        "4/11 (금)", "4/12 (토)", "4/13 (일)",
      ]}
      timeSlots={generateTimeSlots(9, 18)}
    />
  ),
};
