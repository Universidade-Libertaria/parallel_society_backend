import * as functions from 'firebase-functions';
import { db } from '../firebase';
import { verifyAuthToken } from '../services/auth';
import * as admin from 'firebase-admin';

export const publishProposal = functions.https.onRequest(async (req, res) => {
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

        const { id } = req.body;
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
            res.status(403).json({ error: 'Permission denied. Only the proposal author can publish.' });
            return;
        }

        // 4. Validate status
        if (data.status !== 'DRAFT') {
            res.status(400).json({
                error: 'Invalid status transition',
                message: `Proposal must be in DRAFT status to publish. Current: ${data.status}`
            });
            return;
        }

        // 5. Transition DRAFT → IN_DISCUSSION
        const now = Date.now();
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

        const updateData = {
            status: 'IN_DISCUSSION',
            discussionStartedAt: admin.firestore.Timestamp.fromMillis(now),
            discussionEndsAt: admin.firestore.Timestamp.fromMillis(now + SEVEN_DAYS_MS)
        };

        await proposalRef.update(updateData);

        // 6. Return full proposal
        const updated = { ...data, ...updateData, id: doc.id };
        res.status(200).json({
            ...updated,
            createdAt: data.createdAt?.toMillis?.() ?? data.createdAt,
            startTime: data.startTime?.toMillis?.() ?? data.startTime,
            endTime: data.endTime?.toMillis?.() ?? data.endTime,
            discussionStartedAt: now,
            discussionEndsAt: now + SEVEN_DAYS_MS
        });

    } catch (error: any) {
        console.error('Error in publishProposal:', error);
        res.status(500).json({ error: error.message || 'An unexpected error occurred' });
    }
});
