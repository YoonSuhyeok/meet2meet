/** 서버 에러 코드 → 사용자 노출 메시지 매핑 */
export const SERVER_ERROR_MESSAGES: Record<string, string> = {
	validation_failed: "입력값을 다시 확인해주세요.",
	title_required: "미팅 제목을 입력해주세요.",
	title_too_long: "제목은 50자 이내로 입력해주세요.",
	description_too_long: "설명은 200자 이내로 입력해주세요.",
	location_too_long: "장소는 100자 이내로 입력해주세요.",
	dates_required: "후보 날짜를 1개 이상 선택해주세요.",
	dates_too_many: "날짜는 최대 14일까지 선택할 수 있습니다.",
	time_range_invalid: "종료 시간은 시작 시간보다 뒤여야 합니다.",
	rate_limited: "요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.",
	server_error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
};

/** 미팅 생성 실패의 기본 메시지 (코드/메시지를 모를 때) */
export const DEFAULT_MEETING_CREATE_ERROR =
	"미팅 생성에 실패했습니다. 다시 시도해주세요.";

/**
 * 서버 응답을 사용자용 메시지 한 줄로 변환합니다.
 * 우선순위: code 매핑 → body.message → status 카테고리 → 기본 메시지.
 */
export function resolveServerErrorMessage(
	status: number,
	body: { code?: string; message?: string } | null,
): string {
	if (body?.code && SERVER_ERROR_MESSAGES[body.code]) {
		return SERVER_ERROR_MESSAGES[body.code];
	}
	if (body?.message) {
		return body.message;
	}
	if (status === 429) {
		return SERVER_ERROR_MESSAGES.rate_limited;
	}
	if (status >= 500) {
		return SERVER_ERROR_MESSAGES.server_error;
	}
	if (status >= 400) {
		return SERVER_ERROR_MESSAGES.validation_failed;
	}
	return DEFAULT_MEETING_CREATE_ERROR;
}
