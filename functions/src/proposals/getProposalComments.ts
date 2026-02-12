import * as functions from 'firebase-functions';
import { db } from '../firebase';
import { verifyAuthToken } from '../services/auth';
import { CommentResponse, CommentsListResponse } from '../types';

const COMMENTS_PAGE_SIZE = 20;

export const getProposalComments = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET');
        res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.status(204).send('');
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const proposalId = req.query.proposalId as string;
        const sort = (req.query.sort as string) || 'TOP';
        const cursor = req.query.cursor as string | undefined;
        const parentId = req.query.parentId as string | undefined;

        if (!proposalId) {
            res.status(400).json({ error: 'Missing required parameter: proposalId' });
            return;
        }

        // Resolve caller address if authenticated (for myVote)
        let callerAddress: string | null = null;
        if (req.headers.authorization) {
            try {
                callerAddress = await verifyAuthToken(req.headers.authorization);
                callerAddress = callerAddress.toLowerCase();
            } catch {
                // Silent auth fail — still return comments without myVote
            }
        }

        // Build query
        const commentsRef = db.collection('proposals').doc(proposalId).collection('comments');

        // Filter by parentId
        let query: FirebaseFirestore.Query = parentId
            ? commentsRef.where('parentId', '==', parentId)
            : commentsRef.where('parentId', '==', null);

        // Sort
        switch (sort) {
            case 'NEWEST':
                query = query.orderBy('createdAt', 'desc');
                break;
            case 'MOST_INFLUENTIAL':
                query = query.orderBy('voteScore', 'desc');
                break;
            case 'TOP':
            default:
                query = query.orderBy('voteScore', 'desc');
                break;
        }

        // Get total count (without pagination)
        const countSnapshot = await query.count().get();
        const totalCount = countSnapshot.data().count;

        // Apply cursor-based pagination
        if (cursor) {
            const cursorDoc = await commentsRef.doc(cursor).get();
            if (cursorDoc.exists) {
                query = query.startAfter(cursorDoc);
            }
        }

        query = query.limit(COMMENTS_PAGE_SIZE);

        const snapshot = await query.get();

        // Build response items
        const items: CommentResponse[] = [];

        for (const doc of snapshot.docs) {
            const data = doc.data();

            // Get caller's vote if authenticated
            let myVote: 'UP' | 'DOWN' | null = null;
            if (callerAddress) {
                const voteDoc = await commentsRef.doc(doc.id)
                    .collection('votes').doc(callerAddress).get();
                if (voteDoc.exists) {
                    myVote = voteDoc.data()!.direction;
                }
            }

            items.push({
                id: doc.id,
                proposalId,
                author: data.author,
                createdAt: data.createdAt,
                text: data.text,
                vote: {
                    up: data.voteUp || 0,
                    down: data.voteDown || 0,
                    score: data.voteScore || 0
                },
                replyCount: data.replyCount || 0,
                parentId: data.parentId,
                isHidden: data.isHidden || false,
                myVote
            });
        }

        // Determine next cursor
        const lastDoc = snapshot.docs[snapshot.docs.length - 1];
        const nextCursor = snapshot.docs.length === COMMENTS_PAGE_SIZE && lastDoc
            ? lastDoc.id
            : null;

        const response: CommentsListResponse = {
            items,
            nextCursor,
            totalCount
        };

        res.status(200).json(response);

    } catch (error: any) {
        console.error('Error in getProposalComments:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});
