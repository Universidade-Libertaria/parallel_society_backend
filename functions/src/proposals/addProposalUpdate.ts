import * as functions from 'firebase-functions';
import { db } from '../firebase';
import { verifyAuthToken } from '../services/auth';
import * as admin from 'firebase-admin';
import { CreateProposalUpdateRequest, Proposal, ProposalUpdate } from '../types';

export const addProposalUpdate = functions.https.onRequest(async (req, res) => {
    // CORS Header
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
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({ error: 'Missing Authorization header' });
            return;
        }

        const authorAddress = await verifyAuthToken(authHeader);
        const lowerAuthorAddress = authorAddress.toLowerCase();

        const body = req.body as CreateProposalUpdateRequest;
        if (!body.proposalId || !body.status || !body.content) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        const attachments = (req.body as { attachments?: unknown }).attachments;
        if (Array.isArray(attachments) ? attachments.length > 0 : attachments !== undefined) {
            res.status(400).json({ error: 'Proposal update attachments are no longer supported' });
            return;
        }

        // 2. Verify Proposal Ownership
        const proposalRef = db.collection('proposals').doc(body.proposalId);
        const proposalDoc = await proposalRef.get();

        if (!proposalDoc.exists) {
            res.status(404).json({ error: 'Proposal not found' });
            return;
        }

        const proposalData = proposalDoc.data() as Proposal;
        if (proposalData.authorAddress.toLowerCase() !== lowerAuthorAddress) {
            res.status(403).json({ error: 'Only the proposal author can add updates' });
            return;
        }

        if (proposalData.status !== 'PASSED') {
            res.status(403).json({ error: 'Proposal updates are only allowed for passed proposals' });
            return;
        }

        // 3. Create Update
        const updateData: ProposalUpdate = {
            proposalId: body.proposalId,
            authorAddress: lowerAuthorAddress,
            status: body.status,
            content: body.content,
            createdAt: admin.firestore.Timestamp.now()
        };

        const updateRef = await db.collection('proposal_updates').add(updateData);

        res.status(201).json({
            id: updateRef.id,
            ...updateData,
            createdAt: (updateData.createdAt as admin.firestore.Timestamp).toMillis()
        });

    } catch (error: any) {
        console.error('Error adding proposal update:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});
