import { ethers } from 'ethers';
import { CONFIG } from '../config';

/**
 * EIP-712 Domain for Parallel Society Governance
 * Matching Snapshot-style domain
 */
export const EIP712_DOMAIN = {
    name: CONFIG.EIP712.DOMAIN_NAME,
    version: CONFIG.EIP712.DOMAIN_VERSION
};

/**
 * EIP-712 Types for Vote and Proposal
 */
export const EIP712_TYPES = {
    Vote: [
        { name: 'proposalId', type: 'string' },
        { name: 'voter', type: 'address' },
        { name: 'choice', type: 'string' },
        { name: 'snapshotBlock', type: 'uint256' },
        { name: 'timestamp', type: 'uint64' }
    ],
    Proposal: [
        { name: 'from', type: 'address' },
        { name: 'space', type: 'string' },
        { name: 'timestamp', type: 'uint64' },
        { name: 'type', type: 'string' },
        { name: 'title', type: 'string' },
        { name: 'body', type: 'string' },
        { name: 'discussion', type: 'string' },
        { name: 'choices', type: 'string[]' },
        { name: 'start', type: 'uint64' },
        { name: 'end', type: 'uint64' },
        { name: 'snapshot', type: 'uint64' },
        { name: 'plugins', type: 'string' },
        { name: 'app', type: 'string' }
    ]
};

/**
 * Vote message structure
 */
export interface VoteMessage {
    proposalId: string;
    voter: string;
    choice: 'FOR' | 'AGAINST';
    snapshotBlock: number;
    timestamp: number;
}

/**
 * Proposal message structure
 */
export interface ProposalMessage {
    from: string;
    space: string;
    timestamp: number;
    type: string;
    title: string;
    body: string;
    discussion: string;
    choices: string[];
    start: number;
    end: number;
    snapshot: number;
    plugins: string;
    app: string;
}

/**
 * Verifies a vote signature and recovers the signer address
 * @param message The vote message that was signed
 * @param signature The signature to verify
 * @returns The recovered signer address (lowercase)
 */
export async function verifyVoteSignature(
    message: VoteMessage,
    signature: string
): Promise<string> {
    try {
        const recoveredAddress = ethers.verifyTypedData(
            EIP712_DOMAIN,
            { Vote: EIP712_TYPES.Vote },
            message,
            signature
        );
        return recoveredAddress.toLowerCase();
    } catch (error: any) {
        console.error('Vote signature verification failed:', error.message);
        throw new Error('Invalid vote signature');
    }
}

/**
 * Verifies a proposal signature and recovers the signer address
 * @param message The proposal message that was signed
 * @param signature The signature to verify
 * @returns The recovered signer address (lowercase)
 */
export async function verifyProposalSignature(
    message: ProposalMessage,
    signature: string
): Promise<string> {
    try {
        const recoveredAddress = ethers.verifyTypedData(
            EIP712_DOMAIN,
            { Proposal: EIP712_TYPES.Proposal },
            message,
            signature
        );
        return recoveredAddress.toLowerCase();
    } catch (error: any) {
        console.error('Proposal signature verification failed:', error.message);
        throw new Error('Invalid proposal signature');
    }
}

/**
 * Computes the EIP-712 message hash for a vote
 */
export async function computeVoteHash(message: VoteMessage): Promise<string> {
    return ethers.TypedDataEncoder.hash(
        EIP712_DOMAIN,
        { Vote: EIP712_TYPES.Vote },
        message
    );
}

/**
 * Computes the EIP-712 message hash for a proposal
 */
export async function computeProposalHash(message: ProposalMessage): Promise<string> {
    return ethers.TypedDataEncoder.hash(
        EIP712_DOMAIN,
        { Proposal: EIP712_TYPES.Proposal },
        message
    );
}
