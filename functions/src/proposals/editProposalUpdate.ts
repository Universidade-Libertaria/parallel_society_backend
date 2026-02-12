import * as functions from 'firebase-functions';
import { db } from '../firebase';
import { verifyAuthToken } from '../services/auth';

export const editProposalUpdate = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'PUT, POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.status(204).send('');
        return;
    }

    // Support both PUT and POST for compatibility
    if (req.method !== 'PUT' && req.method !== 'POST') {
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

        // Get update ID from query or body
        const updateId = (req.query.id as string) || req.body.id;
        const proposalId = (req.query.proposalId as string) || req.body.proposalId;

        if (!updateId || !proposalId) {
            res.status(400).json({ error: 'Missing required fields: id, proposalId' });
            return;
        }

        // 2. Load the update from subcollection
        const updateRef = db.collection('proposals').doc(proposalId)
            .collection('updates').doc(updateId);
        const updateDoc = await updateRef.get();

        if (!updateDoc.exists) {
            res.status(404).json({ error: 'Update not found' });
            return;
        }

        const existingData = updateDoc.data()!;

        // 3. Check ownership
        if (existingData.authorAddress.toLowerCase() !== callerAddress) {
            res.status(403).json({ error: 'Permission denied. Only the update author can edit.' });
            return;
        }

        // 4. Apply partial updates
        const updateFields: any = {};
        const ALLOWED_STATUSES = ['Planning', 'In Progress', 'Delayed', 'Completed', 'Started'];

        if (req.body.status) {
            if (!ALLOWED_STATUSES.includes(req.body.status)) {
                res.status(400).json({
                    error: 'Invalid status value',
                    message: `Status must be one of: ${ALLOWED_STATUSES.join(', ')}`
                });
                return;
            }
            updateFields.status = req.body.status;
        }

        if (req.body.content !== undefined) {
            updateFields.content = req.body.content;
        }

        if (req.body.attachments !== undefined) {
            updateFields.attachments = req.body.attachments;
        }

        if (Object.keys(updateFields).length === 0) {
            res.status(400).json({ error: 'No fields to update' });
            return;
        }

        updateFields.lastEditedAt = Date.now();

        await updateRef.update(updateFields);

        // 5. Return updated doc
        const updatedData = { ...existingData, ...updateFields };
        res.status(200).json({
            id: updateId,
            ...updatedData,
            createdAt: existingData.createdAt?.toMillis?.() ?? existingData.createdAt
        });

    } catch (error: any) {
        console.error('Error in editProposalUpdate:', error);
        res.status(500).json({ error: error.message || 'An unexpected error occurred' });
    }
});
