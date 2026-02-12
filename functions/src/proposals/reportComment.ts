import * as functions from 'firebase-functions';
import { db } from '../firebase';
import { verifyAuthToken } from '../services/auth';

export const reportComment = functions.https.onRequest(async (req, res) => {
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

        const { commentId, proposalId, reason } = req.body;

        if (!commentId || !reason || !proposalId) {
            res.status(400).json({ error: 'Missing required fields: commentId, proposalId, reason' });
            return;
        }

        // 2. Verify comment exists
        const commentDoc = await db.collection('proposals').doc(proposalId)
            .collection('comments').doc(commentId).get();

        if (!commentDoc.exists) {
            res.status(404).json({ error: 'Comment not found' });
            return;
        }

        // 3. Create report
        await db.collection('reports').add({
            commentId,
            proposalId,
            reporterAddress: callerAddress,
            reason,
            createdAt: Date.now(),
            status: 'pending'
        });

        res.status(201).json({ message: 'Comment reported successfully' });

    } catch (error: any) {
        console.error('Error in reportComment:', error);
        res.status(500).json({ error: error.message || 'An unexpected error occurred' });
    }
});
