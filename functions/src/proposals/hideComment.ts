import * as functions from 'firebase-functions';
import { db } from '../firebase';
import { verifyAuthToken } from '../services/auth';

export const hideComment = functions.https.onRequest(async (req, res) => {
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

        const { commentId, proposalId } = req.body;

        if (!commentId || !proposalId) {
            res.status(400).json({ error: 'Missing required fields: commentId, proposalId' });
            return;
        }

        // 2. Verify caller is proposal author (moderator)
        const proposalDoc = await db.collection('proposals').doc(proposalId).get();
        if (!proposalDoc.exists) {
            res.status(404).json({ error: 'Proposal not found' });
            return;
        }

        const proposalData = proposalDoc.data()!;
        if (proposalData.authorAddress.toLowerCase() !== callerAddress) {
            res.status(403).json({ error: 'Permission denied. Only the proposal author can moderate comments.' });
            return;
        }

        // 3. Hide the comment
        const commentRef = db.collection('proposals').doc(proposalId)
            .collection('comments').doc(commentId);
        const commentDoc = await commentRef.get();

        if (!commentDoc.exists) {
            res.status(404).json({ error: 'Comment not found' });
            return;
        }

        await commentRef.update({ isHidden: true });

        res.status(200).json({ message: 'Comment hidden successfully', commentId });

    } catch (error: any) {
        console.error('Error in hideComment:', error);
        res.status(500).json({ error: error.message || 'An unexpected error occurred' });
    }
});
