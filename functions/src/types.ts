export interface AuthNonceRequest {
    address: string;
}

export interface AuthVerifyRequest {
    address: string;
    signature: string;
}

export interface AuthResponse {
    nonce?: string;
    token?: string;
    error?: string;
}

// Legacy statuses kept for backward compatibility with existing proposals
export type LegacyProposalStatus = 'UPCOMING' | 'ACTIVE' | 'CLOSED' | 'PASSED' | 'FAILED';

// New governance lifecycle statuses
export type GovernanceProposalStatus =
    | 'DRAFT'
    | 'IN_DISCUSSION'
    | 'READY_FOR_VOTING'
    | 'VOTING_LIVE'
    | 'VOTING_ENDED'
    | 'ACCEPTED'
    | 'REJECTED'
    | 'CANCELED';

export type ProposalStatus = LegacyProposalStatus | GovernanceProposalStatus;

export interface Proposal {
    id?: string;
    title: string;
    category: string;
    description: string;
    authorAddress: string;
    authorName?: string;
    createdAt: any;
    startTime: any;
    endTime: any;
    status: ProposalStatus;

    // Discussion phase
    discussionStartedAt?: any;
    discussionEndsAt?: any;

    // Cancellation
    cancelReason?: string;

    // Editing & revisions
    isEdited?: boolean;
    lastEditedAt?: any;
    revisionCount?: number;

    // Comments
    commentCount?: number;

    // Snapshot strategy
    snapshotBlock?: number;
    snapshotChainId?: number;
    strategy?: string;

    // Tally in raw strings (smallest unit)
    totalForRaw: string;
    totalAgainstRaw: string;
    tokenPowerVotedRaw: string;

    totalVoters: number;
    finalizedAt?: any;
    userVotingPowerRaw?: string;

    // IPFS Pinned Artifacts
    proposalCid?: string | null;
    proposalCidPinnedAt?: any | null;
    proposalCidStatus?: 'pinned' | 'pending' | 'failed';

    resultsCid?: string | null;
    resultsCidPinnedAt?: any | null;
    resultsCidStatus?: 'pinned' | 'pending' | 'failed';

    // Signature verification
    signature?: string;
    messageHash?: string;
    timestamp?: number;
}

export interface Vote {
    id?: string;
    proposalId: string;
    voterAddress: string;
    choice: 'FOR' | 'AGAINST';
    weightRaw: string;
    createdAt: any;
}

export interface CreateProposalRequest {
    title: string;
    category: string;
    description: string;
    startTime?: number;
    endTime?: number;
    signature: string;
    messageHash: string;
    timestamp: number;
    snapshotBlock: number;
}

export interface ProposalUpdate {
    id?: string;
    proposalId: string;
    authorAddress: string;
    authorName?: string;
    status: 'Planning' | 'In Progress' | 'Delayed' | 'Completed' | 'Started';
    content: string;
    createdAt: any;
    attachments?: ProposalUpdateAttachment[];
}

export interface ProposalUpdateAttachment {
    name: string;
    fileType: 'document' | 'image' | 'link';
    url: string;
    size?: number;
}

export interface AddProposalUpdateRequest {
    proposalId: string;
    status: 'Planning' | 'In Progress' | 'Delayed' | 'Completed' | 'Started';
    content: string;
    attachments?: ProposalUpdateAttachment[];
}

// --- Phase 2: Comments ---

export interface CommentDoc {
    id?: string;
    proposalId: string;
    author: {
        address: string;
        displayName?: string;
        avatarUrl?: string;
    };
    text: string;
    parentId: string | null;
    createdAt: number;
    isHidden: boolean;
    isEdited?: boolean;
    lastEditedAt?: number;
    voteUp: number;
    voteDown: number;
    voteScore: number;
    replyCount: number;
}

export interface CommentVoteDoc {
    direction: 'UP' | 'DOWN';
    createdAt: number;
}

export interface CommentResponse {
    id: string;
    proposalId: string;
    author: { address: string; displayName?: string; avatarUrl?: string };
    createdAt: number;
    text: string;
    vote: { up: number; down: number; score: number };
    replyCount: number;
    parentId: string | null;
    isHidden: boolean;
    myVote: 'UP' | 'DOWN' | null;
}

export interface CommentsListResponse {
    items: CommentResponse[];
    nextCursor: string | null;
    totalCount: number;
}

// --- Phase 5: Revisions ---

export interface RevisionDoc {
    id?: string;
    proposalId: string;
    revisionNumber: number;
    title: string;
    description: string;
    changeNotes: string;
    createdAt: number;
    authorAddress: string;
}

// --- Phase 7: Permissions ---

export interface ProposalPermissions {
    canEdit: boolean;
    canStartVote: boolean;
    canCancel: boolean;
    canComment: boolean;
    canModerate: boolean;
}
