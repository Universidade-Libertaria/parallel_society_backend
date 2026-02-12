import * as functions from 'firebase-functions';
import { db } from '../firebase';
import { RevisionDoc } from '../types';

export const getProposalRevisions = functions.https.onRequest(async (req, res) => {
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
        const proposalId = req.query.proposalId as string;

        if (!proposalId) {
            res.status(400).json({ error: 'Missing required parameter: proposalId' });
            return;
        }

        // Check proposal exists
        const proposalDoc = await db.collection('proposals').doc(proposalId).get();
        if (!proposalDoc.exists) {
            res.status(404).json({ error: 'Proposal not found' });
            return;
        }

        // Query revisions ordered by revisionNumber DESC
        const snapshot = await db.collection('proposals').doc(proposalId)
            .collection('revisions')
            .orderBy('revisionNumber', 'desc')
            .get();

        const revisions: RevisionDoc[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data() as Omit<RevisionDoc, 'id'>
        }));

        res.status(200).json(revisions);

    } catch (error: any) {
        console.error('Error in getProposalRevisions:', error);
        res.status(500).json({ error: 'Failed to fetch revisions' });
    }
});
