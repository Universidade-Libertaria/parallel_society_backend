import * as admin from 'firebase-admin';
import { db } from '../firebase';
import { Proposal } from '../types';
import { recomputeTally } from './tally';
import { compareRaw } from './numbers';
import { ipfsRpc } from './ipfsRpc';

// All terminal statuses (both legacy and new) that should not be re-finalized
const TERMINAL_STATUSES = ['PASSED', 'FAILED', 'CLOSED', 'ACCEPTED', 'REJECTED', 'CANCELED'];

// Statuses that have IPFS result pinning
const RESULT_PINNABLE_STATUSES = ['PASSED', 'FAILED', 'ACCEPTED', 'REJECTED'];

// Typed update data for finalization writes
interface FinalizeUpdate {
    [key: string]: any;
    totalForRaw: string;
    totalAgainstRaw: string;
    totalVoters: number;
    tokenPowerVotedRaw: string;
    status: string;
    finalizedAt: FirebaseFirestore.Timestamp;
    resultsCidStatus: string;
}

/**
 * Read-only status resolver for GET endpoints.
 * Computes the *effective* status of a proposal WITHOUT performing any
 * Firestore writes or external calls (IPFS). This is safe to call from
 * unauthenticated read endpoints like getProposal and listProposals.
 */
export function resolveEffectiveStatus(proposalData: Proposal): Proposal {
    const now = admin.firestore.Timestamp.now();

    // Already in a terminal status — nothing to resolve
    if (TERMINAL_STATUSES.includes(proposalData.status)) {
        return proposalData;
    }

    // New governance statuses — managed by scheduled functions
    if (['DRAFT', 'IN_DISCUSSION', 'READY_FOR_VOTING', 'VOTING_ENDED'].includes(proposalData.status)) {
        return proposalData;
    }

    // Legacy ACTIVE/VOTING_LIVE — check if voting period ended (read-only projection)
    if (proposalData.status === 'VOTING_LIVE' || proposalData.status === 'ACTIVE') {
        if (!proposalData.endTime || now.toMillis() < proposalData.endTime.toMillis()) {
            return proposalData; // Still active
        }
        // Voting ended but not yet finalized by the scheduled function.
        // Return VOTING_ENDED as effective status so the frontend knows it's pending finalization.
        return { ...proposalData, status: 'VOTING_ENDED' };
    }

    // Legacy UPCOMING — check if should be ACTIVE now (read-only projection)
    if (proposalData.status === 'UPCOMING') {
        if (proposalData.startTime && now.toMillis() >= proposalData.startTime.toMillis()) {
            return { ...proposalData, status: 'ACTIVE' };
        }
        return proposalData;
    }

    return proposalData;
}

/**
 * @deprecated Use resolveEffectiveStatus for GET endpoints.
 * Kept for backward compatibility — calls resolveEffectiveStatus internally.
 */
export async function finalizeProposalIfNeeded(proposalId: string, proposalData: Proposal): Promise<Proposal> {
    return resolveEffectiveStatus(proposalData);
}

/**
 * Executes actual finalization within a Firestore transaction.
 * Should ONLY be called from scheduled functions or admin endpoints.
 * Prevents race conditions via transaction-level read-then-write.
 */
export async function executeFinalization(proposalId: string): Promise<void> {
    const now = admin.firestore.Timestamp.now();
    const ref = db.collection('proposals').doc(proposalId);

    let finalizedData: { status: string; proposalData: Proposal } | null = null;

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
            console.warn(`[finalize] Proposal ${proposalId} not found in transaction.`);
            return;
        }

        const current = snap.data() as Proposal;

        // Already finalized — skip
        if (TERMINAL_STATUSES.includes(current.status)) {
            // Check if results CID is missing and should be pinned (outside transaction)
            if (!current.resultsCid && RESULT_PINNABLE_STATUSES.includes(current.status)) {
                finalizedData = { status: current.status, proposalData: current };
            }
            return;
        }

        // Only finalize ACTIVE or VOTING_LIVE proposals whose endTime has passed
        if (current.status !== 'VOTING_LIVE' && current.status !== 'ACTIVE') {
            return;
        }

        if (!current.endTime || now.toMillis() < current.endTime.toMillis()) {
            return; // Voting period hasn't ended yet
        }

        // Recompute tally (reads only — safe inside transaction context)
        const tally = await recomputeTally(proposalId);

        const isPassed = compareRaw(tally.totalForRaw, tally.totalAgainstRaw) > 0;
        const finalStatus = current.status === 'VOTING_LIVE'
            ? (isPassed ? 'ACCEPTED' : 'REJECTED')
            : (isPassed ? 'PASSED' : 'FAILED');

        const updateData: FinalizeUpdate = {
            ...tally,
            status: finalStatus,
            finalizedAt: now,
            resultsCidStatus: 'pending'
        };

        tx.update(ref, updateData);
        console.log(`[finalize] ${proposalId} → ${finalStatus} (via transaction)`);

        finalizedData = {
            status: finalStatus,
            proposalData: { ...current, ...updateData } as Proposal
        };
    });

    // Pin results bundle OUTSIDE the transaction (external HTTP call)
    if (finalizedData) {
        await pinResultsBundle(proposalId, (finalizedData as any).proposalData);
    }
}

/**
 * Handles legacy UPCOMING → ACTIVE transitions within a transaction.
 * Should ONLY be called from scheduled functions.
 */
export async function activateUpcomingProposal(proposalId: string): Promise<void> {
    const now = admin.firestore.Timestamp.now();
    const ref = db.collection('proposals').doc(proposalId);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return;

        const current = snap.data() as Proposal;
        if (current.status !== 'UPCOMING') return;

        if (current.startTime && now.toMillis() >= current.startTime.toMillis()) {
            tx.update(ref, { status: 'ACTIVE' });
            console.log(`[finalize] ${proposalId}: UPCOMING → ACTIVE (via transaction)`);
        }
    });
}

/**
 * Builds and pins the results bundle to IPFS
 */
async function pinResultsBundle(proposalId: string, proposal: Proposal) {
    try {
        console.log(`[finalize] Building results bundle for ${proposalId}...`);

        // Fetch all votes
        const votesSnapshot = await db.collection('votes')
            .where('proposalId', '==', proposalId)
            .get();

        const votes = votesSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                voter: data.voterAddress,
                choice: data.choice,
                weightRaw: data.weightRaw,
                signature: data.signature,
                messageHash: data.messageHash
            };
        });

        const resultsBundle = {
            schema: "parallel.results.v1",
            proposalId: proposalId,
            snapshotBlock: proposal.snapshotBlock,
            finalizedAt: proposal.finalizedAt ?
                (typeof proposal.finalizedAt === 'number' ? Math.floor(proposal.finalizedAt / 1000) : Math.floor(proposal.finalizedAt.toMillis() / 1000))
                : Math.floor(Date.now() / 1000),
            status: proposal.status,
            totals: {
                forRaw: proposal.totalForRaw,
                againstRaw: proposal.totalAgainstRaw,
                tokenPowerVotedRaw: proposal.tokenPowerVotedRaw,
                totalVoters: proposal.totalVoters
            },
            votes: votes
        };

        console.log(`[finalize] Pinning results bundle to IPFS for proposal: ${proposalId}...`);
        const cid = await ipfsRpc.pinJson(resultsBundle);
        console.log(`[finalize] Results CID generated: ${cid}`);

        await db.collection('proposals').doc(proposalId).update({
            resultsCid: cid,
            resultsCidPinnedAt: admin.firestore.Timestamp.now(),
            resultsCidStatus: 'pinned'
        });
        console.log(`[finalize] Firestore updated with results CID for ${proposalId}`);
    } catch (error: any) {
        console.error(`[finalize] Failed to pin results bundle for ${proposalId}:`, error.message);
        if (error.stack) console.error(error.stack);

        await db.collection('proposals').doc(proposalId).update({
            resultsCidStatus: 'failed',
            ipfsResultsError: error.message
        });
    }
}
