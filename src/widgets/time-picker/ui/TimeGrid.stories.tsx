import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { generateTimeSlots } from "@/src/entities/meeting";
import type { SlotKey } from "@/src/entities/meeting";
import { TimeGrid } from "./TimeGrid";

const meta: Meta<typeof TimeGrid> = {
  title: "Widgets/TimeGrid",
  component: TimeGrid,
  parameters: {
    layout: "centered",
  },
};

export default meta;

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

export const Default: StoryObj = {
  render: () => (
    <TimeGridWithState
      dates={["4/11 (금)", "4/12 (토)", "4/13 (일)"]}
      timeSlots={generateTimeSlots(9, 12)}
    />
  ),
};

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

export const Mobile: StoryObj = {
  render: () => (
    <TimeGridWithState
      dates={[
        "4/7 (월)", "4/8 (화)", "4/9 (수)", "4/10 (목)",
        "4/11 (금)", "4/12 (토)", "4/13 (일)",
      ]}
      timeSlots={generateTimeSlots(9, 18)}
    />
  ),
  globals: {
    viewport: {
      value: "mobile",
      isRotated: false
    }
  },
};
