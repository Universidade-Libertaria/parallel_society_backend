import * as functions from 'firebase-functions';
import { db } from '../firebase';
import { resolveEffectiveStatus } from '../services/finalize';
import { verifyAuthToken } from '../services/auth';
import { getBalanceAtBlock } from '../services/lutBalance';
import { Proposal, ProposalPermissions } from '../types';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');

export const getProposal = functions.https.onRequest(async (req, res) => {
    // CORS Header — restricted to allowed origins
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET');
        res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.status(204).send('');
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    // Extract ID from query or path
    let id = req.query.id as string;
    if (!id) {
        const pathSegments = req.path.split('/');
        id = pathSegments[pathSegments.length - 1];
    }

    if (!id || id === 'proposals' || id === '/') {
        res.status(400).json({ error: 'Missing proposal ID' });
        return;
    }

    try {
        const doc = await db.collection('proposals').doc(id).get();
        if (!doc.exists) {
            res.status(404).json({ error: 'Proposal not found' });
            return;
        }

        const data = doc.data() as Proposal;
        const finalized = resolveEffectiveStatus(data);

        // Fetch user's vote, voting power, and compute permissions if authenticated
        let myVote = null;
        let userVotingPowerRaw = '0';
        let permissions: ProposalPermissions = {
            canEdit: false,
            canStartVote: false,
            canCancel: false,
            canComment: finalized.status === 'IN_DISCUSSION',
            canModerate: false
        };

        const authHeader = req.headers.authorization;
        if (authHeader) {
            try {
                const voterAddress = await verifyAuthToken(authHeader);
                const lowerVoterAddress = voterAddress.toLowerCase();
                const isAuthor = lowerVoterAddress === finalized.authorAddress.toLowerCase();

                // 1. Get My Vote
                const voteDoc = await db.collection('votes').doc(`${id}_${lowerVoterAddress}`).get();
                if (voteDoc.exists) {
                    const vData = voteDoc.data()!;
                    myVote = {
                        choice: vData.choice,
                        weightRaw: vData.weightRaw
                    };
                }

                // 2. Get Snapshot Voting Power
                const snapshotBlock = data.snapshotBlock || 'latest';
                try {
                    userVotingPowerRaw = await getBalanceAtBlock(lowerVoterAddress, snapshotBlock);
                    console.log(`[getProposal] Resolved voting power for ${lowerVoterAddress} at block ${snapshotBlock}: ${userVotingPowerRaw}`);
                } catch (balanceErr: any) {
                    console.error('[getProposal] Failed to get voting power:', balanceErr.message);
                }

                // 3. Compute Permissions
                permissions = {
                    canEdit: ['DRAFT', 'IN_DISCUSSION'].includes(finalized.status) && isAuthor,
                    canStartVote: finalized.status === 'READY_FOR_VOTING' && isAuthor,
                    canCancel: ['DRAFT', 'IN_DISCUSSION'].includes(finalized.status) && isAuthor,
                    canComment: finalized.status === 'IN_DISCUSSION',
                    canModerate: isAuthor
                };

            } catch (authError) {
                console.warn('Silent auth failed in getProposal:', authError);
            }
        }

        // Fetch author's username
        let authorName = null;
        const authorDoc = await db.collection('users').doc(finalized.authorAddress.toLowerCase()).get();
        if (authorDoc.exists) {
            authorName = authorDoc.data()?.username || null;
        }

        res.status(200).json({
            id: doc.id,
            ...finalized,
            authorName,
            createdAt: finalized.createdAt?.toMillis?.() ?? finalized.createdAt,
            startTime: finalized.startTime?.toMillis?.() ?? finalized.startTime,
            endTime: finalized.endTime?.toMillis?.() ?? finalized.endTime,
            finalizedAt: finalized.finalizedAt?.toMillis?.() ?? finalized.finalizedAt ?? null,
            discussionStartedAt: finalized.discussionStartedAt?.toMillis?.() ?? finalized.discussionStartedAt ?? null,
            discussionEndsAt: finalized.discussionEndsAt?.toMillis?.() ?? finalized.discussionEndsAt ?? null,
            lastEditedAt: finalized.lastEditedAt?.toMillis?.() ?? finalized.lastEditedAt ?? null,
            myVote,
            userVotingPowerRaw,
            permissions
        });
    } catch (error: any) {
        console.error('Error getting proposal:', error);
        res.status(500).json({ error: 'Failed to fetch proposal' });
    }
});
