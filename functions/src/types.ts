export type ProposalCategory = 'Finance' | 'Operations' | 'Governance' | 'Other';
export const PROPOSAL_CATEGORIES: ProposalCategory[] = ['Finance', 'Operations', 'Governance', 'Other'];

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

export interface Proposal {
    id?: string;
    title: string;
    category: ProposalCategory;
    description: string;
    authorAddress: string;
    authorName?: string;
    createdAt: any;
    startTime: any;
    endTime: any;
    status: 'UPCOMING' | 'ACTIVE' | 'CLOSED' | 'PASSED' | 'FAILED';


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
    userVotingPowerRaw?: string; // Voting power of the authenticated user at snapshot

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
    category: ProposalCategory;
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
}

export interface CreateProposalUpdateRequest {
    proposalId: string;
    status: 'Planning' | 'In Progress' | 'Delayed' | 'Completed' | 'Started';
    content: string;
}
