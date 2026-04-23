import { useCallback, useEffect, useMemo, useState } from "react";
import {
	clearStoredAuthToken,
	createAuthHeaders,
	useAuth,
} from "@/src/features/auth";
import { generateTimeSlots } from "@/src/entities/meeting";
import type { DateKey } from "@/src/widgets/date-picker";
import { MeetingForm } from "./MeetingForm";
import { ShareModal } from "./ShareModal";

/** 시간 옵션 생성 (00:00 ~ 23:30, 30분 간격) */
const TIME_OPTIONS = generateTimeSlots(0, 24, 30);

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

interface CreatedMeeting {
	id: string;
	shortId: string;
	inviteCode: string;
	title: string;
}

const INITIAL_FORM: FormState = {
	title: "",
	description: "",
	location: "",
	selectedDates: new Set(),
	startTime: "00:00",
	endTime: "24:00",
};

export default function Page() {
	const { user, loading } = useAuth();
	const [form, setForm] = useState<FormState>(INITIAL_FORM);
	const [errors, setErrors] = useState<FormErrors>({});
	const [submitting, setSubmitting] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const [createdMeeting, setCreatedMeeting] =
		useState<CreatedMeeting | null>(null);

	// ── 인증 가드 ──
	useEffect(() => {
		if (!loading && !user) {
			window.location.href = "/login";
		}
	}, [user, loading]);

	// ── 시간 슬롯 미리보기 ──
	const previewTimeSlots = useMemo(() => {
		const startIdx = TIME_OPTIONS.indexOf(form.startTime);
		const endIdx =
			form.endTime === "24:00"
				? TIME_OPTIONS.length
				: TIME_OPTIONS.indexOf(form.endTime);
		if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) return [];
		return TIME_OPTIONS.slice(startIdx, endIdx);
	}, [form.startTime, form.endTime]);

	const sortedDates = useMemo(
		() => [...form.selectedDates].sort(),
		[form.selectedDates],
	);

	// ── 폼 업데이트 핸들러 ──
	const updateField = useCallback(
		<K extends keyof FormState>(key: K, value: FormState[K]) => {
			setForm((prev) => ({ ...prev, [key]: value }));
			setErrors((prev) => ({ ...prev, [key === "selectedDates" ? "dates" : key]: undefined }));
			setServerError(null);
		},
		[],
	);

	// ── 유효성 검증 ──
	const validate = useCallback((): FormErrors => {
		const errs: FormErrors = {};
		if (!form.title.trim()) {
			errs.title = "제목을 입력해주세요";
		} else if (form.title.length > 50) {
			errs.title = "제목은 50자 이내로 입력해주세요";
		}
		if (form.selectedDates.size === 0) {
			errs.dates = "날짜를 1개 이상 선택해주세요";
		} else if (form.selectedDates.size > 14) {
			errs.dates = "날짜는 최대 14일까지 선택할 수 있습니다";
		}
		const si = TIME_OPTIONS.indexOf(form.startTime);
		const ei =
			form.endTime === "24:00"
				? TIME_OPTIONS.length
				: TIME_OPTIONS.indexOf(form.endTime);
		if (si >= ei) {
			errs.timeRange = "종료 시간은 시작 시간보다 뒤여야 합니다";
		}
		return errs;
	}, [form]);

	// ── 제출 ──
	const handleSubmit = useCallback(async () => {
		const errs = validate();
		if (Object.keys(errs).length > 0) {
			setErrors(errs);
			// 첫 번째 에러 필드로 스크롤
			const firstErrorId =
				errs.title ? "field-title" : errs.dates ? "field-dates" : "field-time";
			document.getElementById(firstErrorId)?.scrollIntoView({ behavior: "smooth", block: "center" });
			return;
		}

		setSubmitting(true);
		setServerError(null);

		try {
			const res = await fetch("/api/meetings", {
				method: "POST",
				headers: createAuthHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({
					title: form.title.trim(),
					description: form.description.trim() || undefined,
					location: form.location.trim() || undefined,
					dates: sortedDates,
					startTime: form.startTime,
					endTime: form.endTime,
				}),
			});

			if (!res.ok) {
				if (res.status === 401) {
					clearStoredAuthToken();
					window.location.href = "/login?error=session_expired";
					return;
				}
				const body = await res.json().catch(() => null);
				throw new Error(
					body?.message ?? "미팅 생성에 실패했습니다. 다시 시도해주세요.",
				);
			}

			const data = await res.json();
			setCreatedMeeting({
				id: data.id,
				shortId: data.shortId,
				inviteCode: data.inviteCode,
				title: data.title,
			});
		} catch (err) {
			setServerError(
				err instanceof Error
					? err.message
					: "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.",
			);
		} finally {
			setSubmitting(false);
		}
	}, [validate, form, sortedDates]);

	// ── 로딩 / 미인증 ──
	if (loading || !user) {
		return (
			<div className="py-16 text-center">
				<div className="mx-auto h-6 w-48 animate-pulse rounded bg-muted" />
			</div>
		);
	}

	return (
		<>
			<MeetingForm
				form={form}
				errors={errors}
				submitting={submitting}
				serverError={serverError}
				sortedDates={sortedDates}
				previewTimeSlots={previewTimeSlots}
				timeOptions={TIME_OPTIONS}
				onUpdateField={updateField}
				onSubmit={handleSubmit}
			/>

			{createdMeeting && (
				<ShareModal
					meeting={createdMeeting}
					onClose={() => setCreatedMeeting(null)}
				/>
			)}
		</>
	);
}
