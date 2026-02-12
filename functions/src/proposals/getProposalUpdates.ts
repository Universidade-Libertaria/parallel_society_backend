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

    try {
        // 1. Extract proposalId from query parameters
        const proposalId = req.query.proposalId as string;
        
        if (!proposalId) {
            console.warn('Missing proposalId parameter');
            res.status(400).json({ error: 'Missing required parameter: proposalId' });
            return;
        }

        console.log(`Fetching updates for proposal: ${proposalId}`);

        // 2. Query subcollection proposals/{proposalId}/updates
        const snapshot = await db.collection('proposals').doc(proposalId)
            .collection('updates')
            .orderBy('createdAt', 'desc')
            .get();

        console.log(`Found ${snapshot.size} updates`);

        // 3. Process updates and enrich with author names
        const updates: any[] = [];
        
        for (const doc of snapshot.docs) {
            const data = doc.data() as ProposalUpdate;
            
            // Fetch author's username from users collection
            let authorName = data.authorName || null;
            if (!authorName) {
                try {
                    const userDoc = await db.collection('users').doc(data.authorAddress.toLowerCase()).get();
                    if (userDoc.exists) {
                        authorName = userDoc.data()?.username || null;
                    }
                } catch (userError) {
                    console.warn(`Failed to fetch username for ${data.authorAddress}:`, userError);
                }
            }

            updates.push({
                id: doc.id,
                ...data,
                authorName,
                createdAt: data.createdAt?.toMillis?.() ?? data.createdAt
            });
        }

        res.status(200).json(updates);

    } catch (error: any) {
        console.error('Error getting proposal updates:', error);
        res.status(500).json({ error: 'Failed to fetch proposal updates' });
    }
});
