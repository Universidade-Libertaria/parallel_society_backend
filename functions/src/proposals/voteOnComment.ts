import * as functions from 'firebase-functions';
import { db } from '../firebase';
import { verifyAuthToken } from '../services/auth';

export const voteOnComment = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        // 1. Verify Auth
        let callerAddress: string;
        try {
            callerAddress = await verifyAuthToken(req.headers.authorization);
            callerAddress = callerAddress.toLowerCase();
        } catch (authError: any) {
            res.status(401).json({ error: authError.message });
            return;
        }

        const { commentId, proposalId, direction } = req.body;

        if (!commentId || !proposalId || !direction) {
            res.status(400).json({ error: 'Missing required fields: commentId, proposalId, direction' });
            return;
        }

        if (!['UP', 'DOWN'].includes(direction)) {
            res.status(400).json({ error: 'Direction must be UP or DOWN' });
            return;
        }

        // 2. Get comment reference
        const commentRef = db.collection('proposals').doc(proposalId)
            .collection('comments').doc(commentId);
        const commentDoc = await commentRef.get();

        if (!commentDoc.exists) {
            res.status(404).json({ error: 'Comment not found' });
            return;
        }

        // 3. Check existing vote
        const voteRef = commentRef.collection('votes').doc(callerAddress);
        const existingVote = await voteRef.get();

        let voteUpDelta = 0;
        let voteDownDelta = 0;
        let newDirection: 'UP' | 'DOWN' | null = null;

        if (existingVote.exists) {
            const existingDirection = existingVote.data()!.direction;

            if (existingDirection === direction) {
                // Same vote again → remove (toggle off)
                if (direction === 'UP') voteUpDelta = -1;
                else voteDownDelta = -1;
                newDirection = null;
                await voteRef.delete();
            } else {
                // Switch vote
                if (direction === 'UP') {
                    voteUpDelta = 1;
                    voteDownDelta = -1;
                } else {
                    voteUpDelta = -1;
                    voteDownDelta = 1;
                }
                newDirection = direction;
                await voteRef.set({ direction, createdAt: Date.now() });
            }
        } else {
            // New vote
            if (direction === 'UP') voteUpDelta = 1;
            else voteDownDelta = 1;
            newDirection = direction;
            await voteRef.set({ direction, createdAt: Date.now() });
        }

        // 4. Update comment vote counters atomically
        const commentData = commentDoc.data()!;
        const newVoteUp = (commentData.voteUp || 0) + voteUpDelta;
        const newVoteDown = (commentData.voteDown || 0) + voteDownDelta;
        const newVoteScore = newVoteUp - newVoteDown;

        await commentRef.update({
            voteUp: newVoteUp,
            voteDown: newVoteDown,
            voteScore: newVoteScore
        });

        res.status(200).json({
            commentId,
            direction: newDirection,
            vote: {
                up: newVoteUp,
                down: newVoteDown,
                score: newVoteScore
            }
        });

    } catch (error: any) {
        console.error('Error in voteOnComment:', error);
        res.status(500).json({ error: error.message || 'An unexpected error occurred' });
    }
});
