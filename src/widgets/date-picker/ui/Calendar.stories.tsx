import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Calendar } from "./Calendar";
import type { DateKey } from "../model/types";

const meta: Meta<typeof Calendar> = {
  title: "Widgets/Calendar",
  component: Calendar,
  parameters: {
    layout: "centered",
  },
};

export default meta;

function CalendarWithState({
  minDate,
  maxDate,
}: {
  minDate?: Date;
  maxDate?: Date;
}) {
  const [selected, setSelected] = useState<Set<DateKey>>(new Set());

  return (
    <div className="space-y-4">
      <Calendar
        selected={selected}
        onSelectionChange={setSelected}
        minDate={minDate}
        maxDate={maxDate}
      />
      <div className="text-sm text-muted-foreground">
        <p>선택된 날짜: {selected.size}개</p>
        {selected.size > 0 && (
          <p className="mt-1">
            {[...selected].sort().join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}

export const Default: StoryObj = {
  render: () => <CalendarWithState />,
};

export const WithMaxDate: StoryObj = {
  render: () => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    return <CalendarWithState maxDate={maxDate} />;
  },
};

export const PastDatesAllowed: StoryObj = {
  render: () => {
    const minDate = new Date();
    minDate.setMonth(minDate.getMonth() - 1);
    return <CalendarWithState minDate={minDate} />;
  },
};

export const Mobile: StoryObj = {
  render: () => <CalendarWithState />,
  globals: {
    viewport: {
      value: "mobile",
      isRotated: false,
    },
  },
};
