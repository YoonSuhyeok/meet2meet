export interface TimeRange {
    start: string;
    end: string;
}

export interface SlotSummary {
    slot: string;
    count: number;
}

export interface MeetingDetailResponse {
    id: string;
    shortId: string;
    inviteCode: string;
    title: string;
    description?: string;
    location?: string;
    dates: string[];
    timeRange: TimeRange;
    hostId: string;
    hostName: string;
    participantCount: number;
    createdAt: string;
    updatedAt: string;
    voteSummary?: SlotSummary[];
}

export interface Vote {
    meetingId: string;
    userId: string;
    userName: string;
    slots: string[];
    updatedAt: string;
}

export interface VoteListResponse {
    meetingId: string;
    votes: Vote[];
    summary: SlotSummary[];
}
