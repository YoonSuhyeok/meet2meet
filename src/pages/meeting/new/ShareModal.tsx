import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/src/shared";

interface ShareModalProps {
	meeting: {
		id: string;
		shortId: string;
		inviteCode: string;
		title: string;
	};
	onClose: () => void;
}

export function ShareModal({ meeting, onClose }: ShareModalProps) {
	const [copiedLink, setCopiedLink] = useState(false);
	const [copiedCode, setCopiedCode] = useState(false);
	const dialogRef = useRef<HTMLDialogElement>(null);

	const shareUrl =
		typeof window !== "undefined"
			? `${window.location.origin}/m/${meeting.shortId}`
			: `/m/${meeting.shortId}`;

	// 모달 열기
	useEffect(() => {
		const dialog = dialogRef.current;
		if (dialog && !dialog.open) {
			dialog.showModal();
		}
	}, []);

	// ESC 키 닫기
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [onClose]);

	const copyToClipboard = useCallback(
		async (text: string, type: "link" | "code") => {
			try {
				await navigator.clipboard.writeText(text);
			} catch {
				// fallback
				const textarea = document.createElement("textarea");
				textarea.value = text;
				textarea.style.position = "fixed";
				textarea.style.opacity = "0";
				document.body.appendChild(textarea);
				textarea.select();
				document.execCommand("copy");
				document.body.removeChild(textarea);
			}

			if (type === "link") {
				setCopiedLink(true);
				setTimeout(() => setCopiedLink(false), 2000);
			} else {
				setCopiedCode(true);
				setTimeout(() => setCopiedCode(false), 2000);
			}
		},
		[],
	);

	return (
		<dialog
			ref={dialogRef}
			className="fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none border-none bg-transparent p-0 backdrop:bg-black/45 backdrop:backdrop-blur-[2px]"
			onClick={(e) => {
				// 백드롭 클릭 차단 (명시적 액션 필요)
				if (e.target === dialogRef.current) {
					e.preventDefault();
				}
			}}
		>
			<div className="flex min-h-full items-center justify-center p-4">
				<div className="w-full max-w-sm rounded-[1.75rem] border border-border/70 bg-background p-7 shadow-[0_35px_90px_-40px_rgba(15,23,42,0.55)]">
					<div className="mb-5 flex items-center justify-between gap-3">
						<div>
							<p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
								Ready to share
							</p>
							<p className="mt-1 text-sm font-medium text-foreground">
								{meeting.title}
							</p>
						</div>
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
							<svg
								className="h-6 w-6 text-green-600"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2.5}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M5 13l4 4L19 7"
								/>
							</svg>
						</div>
					</div>

					<h2 className="text-center text-lg font-bold tracking-tight">
						미팅이 생성되었습니다!
					</h2>
					<p className="mt-1 text-center text-sm leading-6 text-muted-foreground">
						참여자에게 아래 링크나 초대 코드를 공유하세요.
					</p>

					<div className="mt-6 space-y-4">
						<div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
							<p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
								공유 링크
							</p>
							<div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background px-2.5 py-2.5">
								<span className="flex-1 truncate text-xs font-mono text-foreground">
									{shareUrl}
								</span>
								<button
									type="button"
									onClick={() => copyToClipboard(shareUrl, "link")}
									className={cn(
										"shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
										copiedLink
											? "bg-green-100 text-green-700"
											: "bg-primary text-primary-foreground hover:bg-primary/90",
									)}
								>
									{copiedLink ? "복사됨" : "복사"}
								</button>
							</div>
							<div className="mt-4">
								<p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
									초대 코드
								</p>
								<div className="flex items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-3">
									<span className="text-lg font-bold tracking-[0.35em] text-foreground">
										{meeting.inviteCode}
									</span>
									<button
										type="button"
										onClick={() =>
											copyToClipboard(meeting.inviteCode, "code")
										}
										className={cn(
											"shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
											copiedCode
												? "bg-green-100 text-green-700"
												: "bg-primary text-primary-foreground hover:bg-primary/90",
										)}
									>
										{copiedCode ? "복사됨" : "복사"}
									</button>
								</div>
							</div>
						</div>
					</div>

					<div className="mt-6 flex flex-col gap-2">
						<a
							href={`/meeting/${meeting.id}`}
							className="flex items-center justify-center rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
						>
							미팅 페이지로 이동
						</a>
						<a
							href="/"
							className="flex items-center justify-center rounded-full border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
						>
							홈으로 돌아가기
						</a>
					</div>
				</div>
			</div>
		</dialog>
	);
}
