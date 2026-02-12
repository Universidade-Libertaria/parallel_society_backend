import * as functions from 'firebase-functions';
import { db } from '../firebase';
import { verifyAuthToken } from '../services/auth';
import * as admin from 'firebase-admin';

export const editProposal = functions.https.onRequest(async (req, res) => {
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

        const { id, title, description, changeNotes } = req.body;

        if (!id) {
            res.status(400).json({ error: 'Missing proposal ID' });
            return;
        }

        if (!title && !description) {
            res.status(400).json({ error: 'At least one of title or description must be provided' });
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
        if (data.authorAddress.toLowerCase() !== callerAddress) {
            res.status(403).json({ error: 'Permission denied. Only the proposal author can edit.' });
            return;
        }

        // 4. Validate status
        if (!['DRAFT', 'IN_DISCUSSION'].includes(data.status)) {
            res.status(400).json({
                error: 'Cannot edit proposal',
                message: `Proposals can only be edited in DRAFT or IN_DISCUSSION status. Current: ${data.status}`
            });
            return;
        }

        // 5. Build update
        const now = Date.now();
        const currentRevisionCount = data.revisionCount || 0;
        const newRevisionNumber = currentRevisionCount + 1;

        const updateData: any = {
            isEdited: true,
            lastEditedAt: admin.firestore.Timestamp.fromMillis(now),
            revisionCount: newRevisionNumber
        };

        if (title) updateData.title = title;
        if (description) updateData.description = description;

        // 6. Create revision snapshot
        const revisionData = {
            proposalId: id,
            revisionNumber: newRevisionNumber,
            title: title || data.title,
            description: description || data.description,
            changeNotes: changeNotes || '',
            createdAt: now,
            authorAddress: callerAddress
        };

        // 7. Atomic write: update proposal + create revision
        const batch = db.batch();
        batch.update(proposalRef, updateData);
        batch.create(proposalRef.collection('revisions').doc(), revisionData);
        await batch.commit();

        // 8. Return updated proposal
        const updatedData = { ...data, ...updateData, id };
        res.status(200).json({
            ...updatedData,
            createdAt: data.createdAt?.toMillis?.() ?? data.createdAt,
            startTime: data.startTime?.toMillis?.() ?? data.startTime,
            endTime: data.endTime?.toMillis?.() ?? data.endTime,
            lastEditedAt: now,
            discussionStartedAt: data.discussionStartedAt?.toMillis?.() ?? data.discussionStartedAt,
            discussionEndsAt: data.discussionEndsAt?.toMillis?.() ?? data.discussionEndsAt
        });

    } catch (error: any) {
        console.error('Error in editProposal:', error);
        res.status(500).json({ error: error.message || 'An unexpected error occurred' });
    }
});
