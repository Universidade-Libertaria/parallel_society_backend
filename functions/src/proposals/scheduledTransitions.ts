import * as functions from 'firebase-functions';
import { db } from '../firebase';
import { executeFinalization, activateUpcomingProposal } from '../services/finalize';
import * as admin from 'firebase-admin';

/**
 * Scheduled function that runs every 15 minutes.
 * Checks for proposals whose discussion period has ended
 * and transitions them from IN_DISCUSSION → READY_FOR_VOTING.
 */
export const checkDiscussionEnd = functions.pubsub
    .schedule('every 15 minutes')
    .onRun(async () => {
        const now = admin.firestore.Timestamp.now();
        console.log(`[checkDiscussionEnd] Running at ${now.toDate().toISOString()}`);

        try {
            const snapshot = await db.collection('proposals')
                .where('status', '==', 'IN_DISCUSSION')
                .where('discussionEndsAt', '<=', now)
                .get();

            if (snapshot.empty) {
                console.log('[checkDiscussionEnd] No proposals to transition.');
                return;
            }

            console.log(`[checkDiscussionEnd] Found ${snapshot.size} proposals to transition.`);

            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.update(doc.ref, { status: 'READY_FOR_VOTING' });
                console.log(`[checkDiscussionEnd] Transitioning ${doc.id} → READY_FOR_VOTING`);
            });

            await batch.commit();
            console.log('[checkDiscussionEnd] Batch committed successfully.');
        } catch (error: any) {
            console.error('[checkDiscussionEnd] Error:', error.message);
        }
    });

/**
 * Scheduled function that runs every 15 minutes.
 * Checks for proposals whose voting period has ended
 * and transitions them from VOTING_LIVE → tallies votes → ACCEPTED or REJECTED.
 */
export const checkVotingEnd = functions.pubsub
    .schedule('every 15 minutes')
    .onRun(async () => {
        const now = admin.firestore.Timestamp.now();
        console.log(`[checkVotingEnd] Running at ${now.toDate().toISOString()}`);

        try {
            // Fetch both VOTING_LIVE and legacy ACTIVE proposals whose voting period ended
            const [votingLiveSnap, activeSnap] = await Promise.all([
                db.collection('proposals')
                    .where('status', '==', 'VOTING_LIVE')
                    .where('endTime', '<=', now)
                    .get(),
                db.collection('proposals')
                    .where('status', '==', 'ACTIVE')
                    .where('endTime', '<=', now)
                    .get()
            ]);

            const allDocs = [...votingLiveSnap.docs, ...activeSnap.docs];

            if (allDocs.length === 0) {
                console.log('[checkVotingEnd] No proposals to finalize.');
                return;
            }

            console.log(`[checkVotingEnd] Found ${allDocs.length} proposals to finalize.`);

            for (const docSnap of allDocs) {
                try {
                    await executeFinalization(docSnap.id);
                    console.log(`[checkVotingEnd] Finalized ${docSnap.id}`);
                } catch (docError: any) {
                    console.error(`[checkVotingEnd] Failed to finalize ${docSnap.id}:`, docError.message);
                }
            }
        } catch (error: any) {
            console.error('[checkVotingEnd] Error:', error.message);
        }
    });

/**
 * Scheduled function that runs every 15 minutes.
 * Handles legacy UPCOMING → ACTIVE transitions.
 */
export const checkLegacyActivation = functions.pubsub
    .schedule('every 15 minutes')
    .onRun(async () => {
        const now = admin.firestore.Timestamp.now();
        console.log(`[checkLegacyActivation] Running at ${now.toDate().toISOString()}`);

        try {
            const snapshot = await db.collection('proposals')
                .where('status', '==', 'UPCOMING')
                .where('startTime', '<=', now)
                .get();

            if (snapshot.empty) {
                console.log('[checkLegacyActivation] No proposals to activate.');
                return;
            }

            console.log(`[checkLegacyActivation] Found ${snapshot.size} proposals to activate.`);

            for (const docSnap of snapshot.docs) {
                try {
                    await activateUpcomingProposal(docSnap.id);
                    console.log(`[checkLegacyActivation] Activated ${docSnap.id}`);
                } catch (docError: any) {
                    console.error(`[checkLegacyActivation] Failed to activate ${docSnap.id}:`, docError.message);
                }
            }
        } catch (error: any) {
            console.error('[checkLegacyActivation] Error:', error.message);
        }
    });
