import * as functions from 'firebase-functions';
import { db } from '../firebase';
import { resolveEffectiveStatus } from '../services/finalize';
import { Proposal } from '../types';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');

export const listProposals = functions.https.onRequest(async (req, res) => {
    // CORS Header — restricted to allowed origins
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Access-Control-Allow-Credentials', 'true');
    }

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
        const snapshot = await db.collection('proposals')
            .orderBy('createdAt', 'desc')
            .get();

        const rawProposals = snapshot.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Proposal)
        }));

        // 1. Collect unique author addresses
        const authorAddresses = [...new Set(rawProposals.map(p => p.authorAddress.toLowerCase()))];

        // 2. Fetch usernames for these addresses
        const authorMap: { [address: string]: string } = {};
        if (authorAddresses.length > 0) {
            // Firestore limit is 10 for 'in' queries, but we can do multiple or just fetch by doc ID
            // Since we might have many authors, let's just fetch them in chunks if needed or individually
            // Actually, for moderate numbers, Promise.all on doc(addr).get() is fine
            await Promise.all(authorAddresses.map(async addr => {
                const userDoc = await db.collection('users').doc(addr).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    if (userData?.username) {
                        authorMap[addr] = userData.username;
                    }
                }
            }));
        }

        const proposals = rawProposals.map(p => {
            const finalized = resolveEffectiveStatus(p);

            return {
                id: p.id,
                title: finalized.title,
                category: finalized.category,
                description: finalized.description,
                authorAddress: finalized.authorAddress,
                authorName: authorMap[finalized.authorAddress.toLowerCase()] || null,
                createdAt: finalized.createdAt.toMillis(),
                startTime: finalized.startTime.toMillis(),
                endTime: finalized.endTime.toMillis(),
                status: finalized.status,
                totalForRaw: finalized.totalForRaw || '0',
                totalAgainstRaw: finalized.totalAgainstRaw || '0',
                totalVoters: finalized.totalVoters || 0,
                tokenPowerVotedRaw: finalized.tokenPowerVotedRaw || '0'
            };
        });

        res.status(200).json(proposals);
    } catch (error: any) {
        console.error('Error listing proposals:', error);
        res.status(500).json({ error: 'Failed to fetch proposals' });
    }
});
