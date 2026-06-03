import * as functions from 'firebase-functions';
import { db } from '../firebase';
import { ProposalUpdate } from '../types';

export const getProposalUpdates = functions.https.onRequest(async (req, res) => {
    // CORS Header
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).send('');
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    const proposalId = req.query.proposalId as string;
    if (!proposalId) {
        res.status(400).json({ error: 'Missing proposalId query parameter' });
        return;
    }

    try {
        const snapshot = await db.collection('proposal_updates')
            .where('proposalId', '==', proposalId)
            .orderBy('createdAt', 'desc')
            .get();

        const updates: ProposalUpdate[] = [];

        // Fetch author details for mapping if needed (though updates usually have authorAddress)
        // For now, we'll return the raw data and let frontend handle user details fetching if needed,
        // or we could join with users collection here. Given the requirement to match ProposalUpdate type:

        for (const doc of snapshot.docs) {
            const data = doc.data();

            // Try to fetch author name if not present (optional enhancement)
            let authorName = data.authorName;
            if (!authorName && data.authorAddress) {
                const userDoc = await db.collection('users').doc(data.authorAddress).get();
                if (userDoc.exists) {
                    authorName = userDoc.data()?.username;
                }
            }

            updates.push({
                id: doc.id,
                proposalId: data.proposalId,
                authorAddress: data.authorAddress,
                authorName: authorName,
                status: data.status,
                content: data.content,
                createdAt: data.createdAt.toMillis() // Convert Timestamp to number
            });
        }

        res.status(200).json(updates);

    } catch (error: any) {
        console.error('Error fetching proposal updates:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});
