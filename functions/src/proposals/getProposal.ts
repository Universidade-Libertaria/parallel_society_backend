import * as functions from 'firebase-functions';
import { db } from '../firebase';
import { finalizeProposalIfNeeded } from '../services/finalize';
import { verifyAuthToken } from '../services/auth';
import { getBalanceAtBlock } from '../services/lutBalance';
import { Proposal } from '../types';

export const getProposal = functions.https.onRequest(async (req, res) => {
    // CORS Header
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
        const finalized = await finalizeProposalIfNeeded(id, data);

        // Fetch user's vote and voting power if authenticated
        let myVote = null;
        let userVotingPowerRaw = '0';
        const authHeader = req.headers.authorization;
        if (authHeader) {
            try {
                const voterAddress = await verifyAuthToken(authHeader); // returns lowercased
                const lowerVoterAddress = voterAddress.toLowerCase();

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
                // Use snapshotBlock from the proposal data
                const snapshotBlock = data.snapshotBlock || 'latest';
                try {
                    userVotingPowerRaw = await getBalanceAtBlock(lowerVoterAddress, snapshotBlock);
                    console.log(`[getProposal] Resolved voting power for ${lowerVoterAddress} at block ${snapshotBlock}: ${userVotingPowerRaw}`);
                } catch (balanceErr: any) {
                    console.error('[getProposal] Failed to get voting power:', balanceErr.message);
                }

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
            createdAt: finalized.createdAt.toMillis(),
            startTime: finalized.startTime.toMillis(),
            endTime: finalized.endTime.toMillis(),
            finalizedAt: finalized.finalizedAt?.toMillis() || null,
            myVote,
            userVotingPowerRaw
        });
    } catch (error: any) {
        console.error('Error getting proposal:', error);
        res.status(500).json({ error: 'Failed to fetch proposal' });
    }
});
