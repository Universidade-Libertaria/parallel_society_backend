import * as functions from 'firebase-functions';
import { db } from '../firebase';
import { verifyAuthToken } from '../services/auth';
import * as admin from 'firebase-admin';

export const cancelProposal = functions.https.onRequest(async (req, res) => {
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
        } catch (authError: any) {
            res.status(401).json({ error: authError.message });
            return;
        }

        const { id, reason } = req.body;
        if (!id) {
            res.status(400).json({ error: 'Missing proposal ID' });
            return;
        }

        // 2. Load Proposal
        const proposalRef = db.collection('proposals').doc(id);
        const doc = await proposalRef.get();

        if (!doc.exists) {
            res.status(404).json({ error: 'Proposal not found' });
            return;
        }

        const data = doc.data()!;

        // 3. Check ownership
        if (data.authorAddress.toLowerCase() !== callerAddress.toLowerCase()) {
            res.status(403).json({ error: 'Permission denied. Only the proposal author can cancel.' });
            return;
        }

        // 4. Validate status — can only cancel from DRAFT or IN_DISCUSSION
        if (!['DRAFT', 'IN_DISCUSSION'].includes(data.status)) {
            res.status(400).json({
                error: 'Invalid status transition',
                message: `Proposal can only be canceled from DRAFT or IN_DISCUSSION. Current: ${data.status}`
            });
            return;
        }

        // 5. Transition → CANCELED
        const updateData: any = {
            status: 'CANCELED',
            finalizedAt: admin.firestore.Timestamp.now()
        };

        if (reason) {
            updateData.cancelReason = reason;
        }

        await proposalRef.update(updateData);

        // 6. Return full proposal
        const updated = { ...data, ...updateData, id: doc.id };
        res.status(200).json({
            ...updated,
            createdAt: data.createdAt?.toMillis?.() ?? data.createdAt,
            startTime: data.startTime?.toMillis?.() ?? data.startTime,
            endTime: data.endTime?.toMillis?.() ?? data.endTime,
            finalizedAt: updateData.finalizedAt.toMillis(),
            discussionStartedAt: data.discussionStartedAt?.toMillis?.() ?? data.discussionStartedAt,
            discussionEndsAt: data.discussionEndsAt?.toMillis?.() ?? data.discussionEndsAt
        });

    } catch (error: any) {
        console.error('Error in cancelProposal:', error);
        res.status(500).json({ error: error.message || 'An unexpected error occurred' });
    }
});
