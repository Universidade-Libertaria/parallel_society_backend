import * as functions from 'firebase-functions';
import { db } from '../firebase';
import { verifyAuthToken } from '../services/auth';

export const deleteProposalUpdate = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'DELETE, POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.status(204).send('');
        return;
    }

    // Support both DELETE and POST for compatibility
    if (req.method !== 'DELETE' && req.method !== 'POST') {
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

        // Get IDs from query or body
        const updateId = (req.query.id as string) || req.body.id;
        const proposalId = (req.query.proposalId as string) || req.body.proposalId;

        if (!updateId || !proposalId) {
            res.status(400).json({ error: 'Missing required fields: id, proposalId' });
            return;
        }

        // 2. Load the update
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
            res.status(403).json({ error: 'Permission denied. Only the update author can delete.' });
            return;
        }

        // 4. Delete
        await updateRef.delete();

        res.status(200).json({ message: 'Update deleted successfully', id: updateId });

    } catch (error: any) {
        console.error('Error in deleteProposalUpdate:', error);
        res.status(500).json({ error: error.message || 'An unexpected error occurred' });
    }
});
