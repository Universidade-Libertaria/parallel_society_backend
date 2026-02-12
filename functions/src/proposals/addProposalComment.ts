import * as functions from 'firebase-functions';
import { db } from '../firebase';
import { verifyAuthToken } from '../services/auth';
import { CommentDoc, CommentResponse } from '../types';
import * as admin from 'firebase-admin';

const MAX_COMMENT_LENGTH = 2000;
const MAX_URLS = 2;

function countUrls(text: string): number {
    const urlRegex = /https?:\/\/[^\s]+/gi;
    const matches = text.match(urlRegex);
    return matches ? matches.length : 0;
}

export const addProposalComment = functions.https.onRequest(async (req, res) => {
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

        const { proposalId, text, parentId } = req.body;

        // 2. Validate body
        if (!proposalId || !text) {
            res.status(400).json({ error: 'Missing required fields: proposalId, text' });
            return;
        }

        if (text.length > MAX_COMMENT_LENGTH) {
            res.status(400).json({
                error: 'Comment too long',
                message: `Maximum ${MAX_COMMENT_LENGTH} characters allowed.`
            });
            return;
        }

        if (countUrls(text) > MAX_URLS) {
            res.status(400).json({
                error: 'Too many URLs',
                message: `Maximum ${MAX_URLS} URLs allowed per comment.`
            });
            return;
        }

        // 3. Check proposal exists and is IN_DISCUSSION
        const proposalRef = db.collection('proposals').doc(proposalId);
        const proposalDoc = await proposalRef.get();

        if (!proposalDoc.exists) {
            res.status(404).json({ error: 'Proposal not found' });
            return;
        }

        const proposalData = proposalDoc.data()!;
        if (proposalData.status !== 'IN_DISCUSSION') {
            res.status(400).json({
                error: 'Comments are only allowed during the discussion phase',
                currentStatus: proposalData.status
            });
            return;
        }

        // 4. Resolve author info
        let displayName: string | undefined;
        let avatarUrl: string | undefined;
        try {
            const userDoc = await db.collection('users').doc(callerAddress).get();
            if (userDoc.exists) {
                const userData = userDoc.data()!;
                displayName = userData.username;
                avatarUrl = userData.avatarUrl;
            }
        } catch (e) {
            console.warn('Failed to fetch user profile:', e);
        }

        // 5. If reply, validate parent exists
        const commentsRef = proposalRef.collection('comments');
        if (parentId) {
            const parentDoc = await commentsRef.doc(parentId).get();
            if (!parentDoc.exists) {
                res.status(404).json({ error: 'Parent comment not found' });
                return;
            }
        }

        // 6. Create comment
        const now = Date.now();
        const commentData: CommentDoc = {
            proposalId,
            author: {
                address: callerAddress,
                displayName,
                avatarUrl
            },
            text,
            parentId: parentId || null,
            createdAt: now,
            isHidden: false,
            voteUp: 0,
            voteDown: 0,
            voteScore: 0,
            replyCount: 0
        };

        const docRef = await commentsRef.add(commentData);

        // 7. Increment counters
        await proposalRef.update({
            commentCount: admin.firestore.FieldValue.increment(1)
        });

        if (parentId) {
            await commentsRef.doc(parentId).update({
                replyCount: admin.firestore.FieldValue.increment(1)
            });
        }

        // 8. Return response
        const response: CommentResponse = {
            id: docRef.id,
            proposalId,
            author: commentData.author,
            createdAt: now,
            text,
            vote: { up: 0, down: 0, score: 0 },
            replyCount: 0,
            parentId: parentId || null,
            isHidden: false,
            myVote: null
        };

        res.status(201).json(response);

    } catch (error: any) {
        console.error('Error in addProposalComment:', error);
        res.status(500).json({ error: error.message || 'An unexpected error occurred' });
    }
});
