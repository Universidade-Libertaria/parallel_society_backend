import * as functions from 'firebase-functions';
import { db } from '../firebase';
import { verifyAuthToken } from '../services/auth';
import { Proposal, ProposalUpdate } from '../types';

export const editProposalUpdate = functions.https.onRequest(async (req, res) => {
    // CORS Header
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'PUT, POST');
        res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.status(204).send('');
        return;
    }

    if (req.method !== 'PUT' && req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        // 1. Verify Auth
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({ error: 'Missing Authorization header' });
            return;
        }

        const authorAddress = await verifyAuthToken(authHeader);
        const lowerAuthorAddress = authorAddress.toLowerCase();

        const body = req.body;
        const updateId = req.query.id as string || body.id;

        if (!updateId) {
            res.status(400).json({ error: 'Missing update ID' });
            return;
        }

        // 2. Fetch Update & Verify Ownership
        const updateRef = db.collection('proposal_updates').doc(updateId);
        const updateDoc = await updateRef.get();

        if (!updateDoc.exists) {
            res.status(404).json({ error: 'Update not found' });
            return;
        }

        const updateData = updateDoc.data() as ProposalUpdate;

        // Check if the requester is the author of the update
        if (updateData.authorAddress.toLowerCase() !== lowerAuthorAddress) {
            res.status(403).json({ error: 'Unauthorized to edit this update' });
            return;
        }

        const proposalDoc = await db.collection('proposals').doc(updateData.proposalId).get();
        if (!proposalDoc.exists) {
            res.status(404).json({ error: 'Proposal not found' });
            return;
        }

        const proposalData = proposalDoc.data() as Proposal;
        if (proposalData.status !== 'PASSED') {
            res.status(403).json({ error: 'Proposal updates are only allowed for passed proposals' });
            return;
        }

        const attachments = (body as { attachments?: unknown }).attachments;
        if (Array.isArray(attachments) ? attachments.length > 0 : attachments !== undefined) {
            res.status(400).json({ error: 'Proposal update attachments are no longer supported' });
            return;
        }

        // 3. Update Fields
        const updates: Partial<ProposalUpdate> = {};
        if (body.status) updates.status = body.status;
        if (body.content) updates.content = body.content;

        if (Object.keys(updates).length === 0) {
            res.status(400).json({ error: 'No editable fields provided' });
            return;
        }

        // Add updated timestamp if desired, though not in original type
        // updates.updatedAt = admin.firestore.Timestamp.now();

        await updateRef.update(updates);

        res.status(200).json({
            id: updateId,
            ...updateData,
            ...updates,
            createdAt: (updateData.createdAt as any).toMillis ? (updateData.createdAt as any).toMillis() : updateData.createdAt
        });

    } catch (error: any) {
        console.error('Error editing proposal update:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});
