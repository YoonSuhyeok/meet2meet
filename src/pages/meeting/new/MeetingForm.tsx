import {
	ArrowRight,
	CalendarDays,
	CheckCircle2,
	Clock3,
	MapPin,
	Sparkles,
} from "lucide-react";
import { type ComponentType, type ReactNode, useCallback, useMemo } from "react";
import { cn } from "@/src/shared";
import { Calendar } from "@/src/widgets/date-picker";
import { TimeGrid } from "@/src/widgets/time-picker";
import type { SlotKey } from "@/src/entities/meeting";
import type { DateKey } from "@/src/widgets/date-picker";

interface FormState {
	title: string;
	description: string;
	location: string;
	selectedDates: Set<DateKey>;
	startTime: string;
	endTime: string;
}

interface FormErrors {
	title?: string;
	dates?: string;
	timeRange?: string;
}

interface MeetingFormProps {
	form: FormState;
	errors: FormErrors;
	submitting: boolean;
	serverError: string | null;
	sortedDates: string[];
	previewTimeSlots: string[];
	timeOptions: string[];
	onUpdateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
	onSubmit: () => void;
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const END_TIME_SENTINEL = "24:00";
const MAX_DATES = 14;

function formatDateLabel(dateKey: string): string {
	const d = new Date(`${dateKey}T00:00:00`);
	const m = d.getMonth() + 1;
	const day = d.getDate();
	const weekday = WEEKDAY_LABELS[d.getDay()];
	return `${m}/${day}(${weekday})`;
}

function formatSelectedDateSummary(sortedDates: string[]) {
	return sortedDates.map(formatDateLabel).join(", ");
}

function FormSection({
	eyebrow,
	title,
	description,
	children,
	className,
}: {
	eyebrow: string;
	title: string;
	description: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<section
			className={cn(
				"rounded-[1.75rem] border border-border/70 bg-background/95 p-5 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.28)] sm:p-7",
				className,
			)}
		>
			<div className="mb-5 space-y-2">
				<p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
					{eyebrow}
				</p>
				<div className="space-y-1">
					<h2 className="text-lg font-semibold tracking-tight text-foreground">
						{title}
					</h2>
					<p className="max-w-[56ch] text-sm leading-6 text-muted-foreground">
						{description}
					</p>
				</div>
			</div>
			{children}
		</section>
	);
}

function SummaryItem({
	icon: Icon,
	label,
	value,
	helper,
}: {
	icon: ComponentType<{ className?: string }>;
	label: string;
	value: string;
	helper?: string;
}) {
	return (
		<div className="rounded-2xl border border-border/70 bg-background/85 p-4">
			<div className="flex items-start gap-3">
				<div className="mt-0.5 rounded-xl bg-accent px-2.5 py-2 text-accent-foreground">
					<Icon className="h-4 w-4" />
				</div>
				<div className="min-w-0">
					<p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
						{label}
					</p>
					<p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
					{helper && (
						<p className="mt-1 text-xs leading-5 text-muted-foreground">
							{helper}
						</p>
					)}
				</div>
			</div>
		</div>
	);
}

export function MeetingForm({
	form,
	errors,
	submitting,
	serverError,
	sortedDates,
	previewTimeSlots,
	timeOptions,
	onUpdateField,
	onSubmit,
}: MeetingFormProps) {
	const today = useMemo(() => new Date(), []);
	const maxDate = useMemo(() => {
		const d = new Date();
		d.setDate(d.getDate() + 30);
		return d;
	}, []);

	const canSubmit =
		form.title.trim().length > 0 &&
		form.selectedDates.size > 0 &&
		!submitting;
	const emptySlots = useMemo(() => new Set<SlotKey>(), []);
	const noop = useCallback(() => {}, []);
	const endTimeOptions = useMemo(
		() => [...timeOptions, END_TIME_SENTINEL],
		[timeOptions],
	);
	const selectedDateSummary = useMemo(
		() => formatSelectedDateSummary(sortedDates),
		[sortedDates],
	);
	const previewColumnDates = useMemo(
		() => sortedDates.map(formatDateLabel),
		[sortedDates],
	);
	const slotsPerDay = previewTimeSlots.length;
	const previewSlotCount = sortedDates.length * previewTimeSlots.length;

	const handleDatesChange = useCallback(
		(dates: Set<DateKey>) => {
			if (dates.size > MAX_DATES) return;
			onUpdateField("selectedDates", dates);
		},
		[onUpdateField],
	);

	const handleStartTimeChange = useCallback(
		(value: string) => {
			onUpdateField("startTime", value);
			const startIdx = timeOptions.indexOf(value);
			const endIdx =
				form.endTime === END_TIME_SENTINEL
					? endTimeOptions.length - 1
					: endTimeOptions.indexOf(form.endTime);

			if (startIdx >= endIdx) {
				const nextIdx = Math.min(startIdx + 1, endTimeOptions.length - 1);
				onUpdateField("endTime", endTimeOptions[nextIdx]);
			}
		},
		[endTimeOptions, form.endTime, onUpdateField, timeOptions],
	);

	const handleEndTimeChange = useCallback(
		(value: string) => {
			onUpdateField("endTime", value);
		},
		[onUpdateField],
	);

	return (
		<div className="space-y-6 pb-10">
			<section className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-6 shadow-[0_28px_80px_-45px_rgba(15,23,42,0.45)] sm:p-8">
				<div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_right,rgba(148,163,184,0.18),transparent_52%),radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_36%)]" />
				<div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
					<div className="max-w-2xl space-y-4">
						<div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
							<Sparkles className="h-3.5 w-3.5" />
							친구 모임 빠르게 만들기
						</div>
						<div className="space-y-3">
							<h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-[2.5rem]">
								날짜만 고르면 바로 공유할 수 있는
								<br className="hidden sm:block" /> 미팅 초안을 만듭니다
							</h1>
							<p className="max-w-[60ch] text-sm leading-6 text-muted-foreground sm:text-[0.95rem]">
								친구들과 조율할 후보 날짜를 한 화면에서 정리하고, 생성
								직후 링크와 초대 코드를 바로 전달하세요.
							</p>
						</div>
					</div>

					<div className="grid gap-3 sm:grid-cols-3 lg:w-[26rem] lg:grid-cols-1">
						<SummaryItem
							icon={CalendarDays}
							label="후보 날짜"
							value={
								sortedDates.length > 0
									? `${sortedDates.length}일 선택됨`
									: "아직 선택 전"
							}
							helper={
								sortedDates.length > 0
									? selectedDateSummary
									: "최대 14일까지 고를 수 있어요."
							}
						/>
						<SummaryItem
							icon={Clock3}
							label="시간 범위"
							value={`${form.startTime} ~ ${form.endTime}`}
							helper={`${slotsPerDay}개 슬롯/일 · 30분 간격`}
						/>
						<SummaryItem
							icon={CheckCircle2}
							label="생성 후 공유"
							value="링크 + 초대 코드"
							helper="생성 성공 후 바로 복사할 수 있습니다."
						/>
					</div>
				</div>
			</section>

			{serverError && (
				<div className="rounded-[1.5rem] border border-destructive/25 bg-destructive/5 px-5 py-4 text-sm text-destructive shadow-[0_12px_32px_-24px_rgba(220,38,38,0.65)]">
					<p className="font-semibold">미팅 생성에 실패했습니다</p>
					<p className="mt-1 leading-6">{serverError}</p>
				</div>
			)}

			<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
				<div className="space-y-6">
					<FormSection
						eyebrow="기본 정보"
						title="모임의 분위기를 먼저 적어둘게요"
						description="제목은 눈에 잘 띄게, 설명과 장소는 있으면 더 좋은 정보만 가볍게 적는 구성이에요."
					>
						<div className="grid gap-5">
							<div id="field-title">
								<label
									htmlFor="meeting-title"
									className="block text-sm font-semibold text-foreground"
								>
									미팅 제목 <span className="text-destructive">*</span>
								</label>
								<input
									id="meeting-title"
									type="text"
									maxLength={50}
									placeholder="예: 금요일 저녁 약속 잡기"
									value={form.title}
									onChange={(e) => onUpdateField("title", e.target.value)}
									className={cn(
										"mt-2 w-full rounded-2xl border bg-background px-4 py-3.5 text-sm outline-none transition-all placeholder:text-muted-foreground/80",
										"focus:border-ring focus:ring-4 focus:ring-ring/10",
										errors.title
											? "border-destructive focus:border-destructive focus:ring-destructive/15"
											: "border-border/80",
									)}
								/>
								<div className="mt-2 flex items-center justify-between gap-4">
									<p className="text-xs text-destructive">
										{errors.title ?? ""}
									</p>
									<p
										className={cn(
											"text-xs",
											form.title.length > 45
												? "text-destructive"
												: "text-muted-foreground",
										)}
									>
										{form.title.length} / 50
									</p>
								</div>
							</div>

							<div>
								<label
									htmlFor="meeting-desc"
									className="block text-sm font-semibold text-foreground"
								>
									설명{" "}
									<span className="text-xs font-medium text-muted-foreground">
										(선택)
									</span>
								</label>
								<textarea
									id="meeting-desc"
									maxLength={200}
									rows={3}
									placeholder="예산, 분위기, 메모가 있다면 간단히 적어두세요"
									value={form.description}
									onChange={(e) => onUpdateField("description", e.target.value)}
									className="mt-2 w-full resize-none rounded-2xl border border-border/80 bg-background px-4 py-3.5 text-sm outline-none transition-all placeholder:text-muted-foreground/80 focus:border-ring focus:ring-4 focus:ring-ring/10"
								/>
								<p className="mt-2 text-right text-xs text-muted-foreground">
									{form.description.length} / 200
								</p>
							</div>

							<div>
								<label
									htmlFor="meeting-location"
									className="block text-sm font-semibold text-foreground"
								>
									장소{" "}
									<span className="text-xs font-medium text-muted-foreground">
										(선택)
									</span>
								</label>
								<div className="relative mt-2">
									<MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
									<input
										id="meeting-location"
										type="text"
										maxLength={100}
										placeholder="예: 성수, 강남역 근처, 미정"
										value={form.location}
										onChange={(e) => onUpdateField("location", e.target.value)}
										className="w-full rounded-2xl border border-border/80 bg-background py-3.5 pl-11 pr-4 text-sm outline-none transition-all placeholder:text-muted-foreground/80 focus:border-ring focus:ring-4 focus:ring-ring/10"
									/>
								</div>
							</div>
						</div>
					</FormSection>

					<FormSection
						eyebrow="날짜 선택"
						title="가능한 날을 한번에 체크해 주세요"
						description="클릭이나 드래그로 여러 날짜를 빠르게 선택할 수 있어요. 필요한 만큼만 고르고 바로 다음 단계로 넘어가면 됩니다."
						className={cn(
							errors.dates && "border-destructive/40 bg-destructive/5",
						)}
					>
						<div id="field-dates" className="space-y-4">
							<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
								<span className="rounded-full bg-accent px-3 py-1">
									오늘부터 30일 안에서 선택
								</span>
								<span className="rounded-full bg-accent px-3 py-1">
									최대 {MAX_DATES}일
								</span>
								<span className="rounded-full bg-accent px-3 py-1">
									Shift+클릭 / 드래그 지원
								</span>
							</div>

							<div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-background p-4 sm:p-5">
								<Calendar
									selected={form.selectedDates}
									onSelectionChange={handleDatesChange}
									minDate={today}
									maxDate={maxDate}
								/>
							</div>

							{errors.dates ? (
								<p className="text-xs font-medium text-destructive">
									{errors.dates}
								</p>
							) : sortedDates.length > 0 ? (
								<p className="text-sm leading-6 text-muted-foreground">
									선택된 날짜 —{" "}
									<span className="font-medium text-foreground">
										{selectedDateSummary}
									</span>{" "}
									· <strong>{sortedDates.length}일</strong>
								</p>
							) : (
								<p className="text-sm leading-6 text-muted-foreground">
									아직 선택된 날짜가 없어요. 달력에서 친구들과 맞춰볼 날을
									골라보세요.
								</p>
							)}
						</div>
					</FormSection>

					<FormSection
						eyebrow="시간 설정"
						title="사람들이 선택할 시간 범위를 정합니다"
						description="기본은 하루 전체가 열려 있고, 필요한 시간대만 좁혀서 보여줄 수 있어요."
					>
						<div id="field-time" className="space-y-5">
							<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
								<select
									value={form.startTime}
									onChange={(e) => handleStartTimeChange(e.target.value)}
									className="rounded-2xl border border-border/80 bg-background px-4 py-3.5 text-sm outline-none transition-all focus:border-ring focus:ring-4 focus:ring-ring/10"
								>
									{timeOptions.map((t) => (
										<option key={t} value={t}>
											{t}
										</option>
									))}
								</select>
								<span className="px-1 text-center text-sm font-medium text-muted-foreground">
									~
								</span>
								<select
									value={form.endTime}
									onChange={(e) => handleEndTimeChange(e.target.value)}
									className="rounded-2xl border border-border/80 bg-background px-4 py-3.5 text-sm outline-none transition-all focus:border-ring focus:ring-4 focus:ring-ring/10"
								>
									{endTimeOptions.map((t) => (
										<option key={t} value={t}>
											{t}
										</option>
									))}
								</select>
							</div>

							<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
								<span className="rounded-full bg-accent px-3 py-1">
									기본 00:00 ~ 24:00
								</span>
								<span className="rounded-full bg-accent px-3 py-1">
									30분 단위
								</span>
								<span className="rounded-full bg-accent px-3 py-1">
									종료 시간은 시작보다 뒤여야 해요
								</span>
							</div>

							{errors.timeRange && (
								<p className="text-xs font-medium text-destructive">
									{errors.timeRange}
								</p>
							)}
						</div>
					</FormSection>

					{sortedDates.length > 0 && previewTimeSlots.length > 0 && (
						<FormSection
							eyebrow="미리보기"
							title="참여자 화면은 이렇게 열립니다"
							description="주최자는 여기서 시간을 고르지 않고, 참여자들이 어떤 격자를 보게 되는지만 확인합니다."
						>
							<div className="space-y-4">
								<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
									<span className="rounded-full bg-accent px-3 py-1">
										{sortedDates.length}일
									</span>
									<span className="rounded-full bg-accent px-3 py-1">
										{slotsPerDay}개 슬롯/일
									</span>
									<span className="rounded-full bg-accent px-3 py-1">
										총 {previewSlotCount}개 셀
									</span>
								</div>
								<div className="overflow-x-auto rounded-[1.5rem] border border-border/70 bg-background p-3 sm:p-4">
									<TimeGrid
										dates={previewColumnDates}
										timeSlots={previewTimeSlots}
										selected={emptySlots}
										onSelectionChange={noop}
									/>
								</div>
							</div>
						</FormSection>
					)}

					<div className="rounded-[1.75rem] border border-border/70 bg-card/80 p-5 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.24)] sm:p-7">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div className="space-y-1">
								<p className="text-sm font-semibold text-foreground">
									이제 바로 생성할 수 있어요
								</p>
								<p className="text-sm leading-6 text-muted-foreground">
									제목과 날짜가 있으면 링크와 초대 코드를 만들 수 있습니다.
								</p>
							</div>
							<button
								type="button"
								disabled={!canSubmit}
								onClick={onSubmit}
								className={cn(
									"inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all",
									canSubmit
										? "bg-primary text-primary-foreground shadow-[0_18px_35px_-20px_rgba(15,23,42,0.55)] hover:-translate-y-0.5 hover:bg-primary/92"
										: "pointer-events-none bg-muted text-muted-foreground opacity-50",
								)}
							>
								{submitting ? (
									<>
										<span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
										생성 중...
									</>
								) : (
									<>
										미팅 만들기
										<ArrowRight className="h-4 w-4" />
									</>
								)}
							</button>
						</div>
					</div>
				</div>

				<aside className="space-y-4 xl:sticky xl:top-28 xl:h-fit">
					<div className="rounded-[1.75rem] border border-border/70 bg-card/90 p-5 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.22)]">
							<p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
								빠른 흐름
						</p>
						<div className="mt-4 space-y-3">
							<div className="rounded-2xl bg-background px-4 py-3">
								<p className="text-sm font-semibold text-foreground">
									1. 제목과 분위기 정리
								</p>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									링크를 받는 사람이 한눈에 이해할 제목이면 충분합니다.
								</p>
							</div>
							<div className="rounded-2xl bg-background px-4 py-3">
								<p className="text-sm font-semibold text-foreground">
									2. 가능한 날 고르기
								</p>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									연속된 날짜는 드래그로 더 빠르게 체크할 수 있어요.
								</p>
							</div>
							<div className="rounded-2xl bg-background px-4 py-3">
								<p className="text-sm font-semibold text-foreground">
									3. 시간 범위만 좁히기
								</p>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									참여자가 고를 슬롯만 남겨두면 응답이 빨라집니다.
								</p>
							</div>
						</div>
					</div>

					<div className="rounded-[1.75rem] border border-border/70 bg-card/90 p-5 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.22)]">
						<p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
							현재 요약
						</p>
						<div className="mt-4 space-y-3 text-sm">
							<div className="flex items-center justify-between gap-4">
								<span className="text-muted-foreground">제목</span>
								<span className="truncate font-medium text-foreground">
									{form.title.trim() || "미정"}
								</span>
							</div>
							<div className="flex items-center justify-between gap-4">
								<span className="text-muted-foreground">장소</span>
								<span className="truncate font-medium text-foreground">
									{form.location.trim() || "미정"}
								</span>
							</div>
							<div className="flex items-center justify-between gap-4">
								<span className="text-muted-foreground">후보 수</span>
								<span className="font-medium text-foreground">
									{sortedDates.length} / {MAX_DATES}
								</span>
							</div>
						</div>
						<div className="mt-4 rounded-2xl bg-background px-4 py-3">
							<p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
								선택된 날짜
							</p>
							<p className="mt-2 text-sm leading-6 text-foreground">
								{sortedDates.length > 0
									? selectedDateSummary
									: "아직 선택된 날짜가 없습니다."}
							</p>
						</div>
					</div>
				</aside>
			</div>
		</div>
	);
}
