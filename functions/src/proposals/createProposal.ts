import * as functions from 'firebase-functions';
import { db } from '../firebase';
import { verifyAuthToken } from '../services/auth';
import { getLUTBalance, provider } from '../services/lutBalance';
import { CreateProposalRequest, Proposal, ProposalCategory, PROPOSAL_CATEGORIES } from '../types';
import * as admin from 'firebase-admin';
import { verifyProposalSignature, EIP712_DOMAIN, EIP712_TYPES, ProposalMessage } from '../services/eip712';
import { ipfsRpc } from '../services/ipfsRpc';

export const createProposal = functions.https.onRequest(async (req, res) => {
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
        console.log('Received createProposal request');
        // 1. Verify Auth
        let authorAddress;
        try {
            authorAddress = await verifyAuthToken(req.headers.authorization);
            console.log(`Authenticated user: ${authorAddress}`);
        } catch (authError: any) {
            console.warn('Auth verification failed:', authError.message);
            res.status(401).json({ error: authError.message });
            return;
        }

        // 2. Check LUT Balance (>= 2000)
        console.log(`Checking LUT balance for: ${authorAddress}`);
        let balance;
        try {
            balance = await getLUTBalance(authorAddress);
            console.log(`Current balance: ${balance}`);
        } catch (balanceError: any) {
            console.error('Error checking LUT balance:', balanceError);
            res.status(500).json({ error: balanceError.message || 'Failed to verify LUT balance' });
            return;
        }

        if (balance < 2000) {
            console.warn(`Insufficient balance: ${balance}`);
            res.status(403).json({
                error: 'Insufficient LUT balance',
                message: 'You need at least 2,000 LUT to create a proposal.',
                currentBalance: balance
            });
            return;
        }

        const body = req.body as CreateProposalRequest;
        console.log('Validating proposal body:', body);

        // 3. Validate Body
        if (!body.title || !body.category || !body.description || !body.signature || !body.messageHash || !body.timestamp || !body.snapshotBlock) {
            console.warn('Missing required fields');
            res.status(400).json({ error: 'Missing required fields (including signature/hash/timestamp)' });
            return;
        }

        const isValidCategory = (value: any): value is ProposalCategory =>
            typeof value === 'string' && PROPOSAL_CATEGORIES.includes(value as ProposalCategory);

        if (!isValidCategory(body.category)) {
            console.warn(`Invalid category provided: ${body.category}`);
            res.status(400).json({
                error: 'Invalid category',
                message: `Category '${body.category}' is not allowed. Allowed categories are: ${PROPOSAL_CATEGORIES.join(', ')}.`
            });
            return;
        }

        // 4. Capture Snapshot Block
        const snapshotBlock = await provider.getBlockNumber();
        console.log(`Snapshot block captured: ${snapshotBlock}`);

        // 5. Verify EIP-712 Signature
        const startTimeVal = body.startTime || Date.now();
        const endTimeVal = body.endTime || (Date.now() + (3 * 24 * 60 * 60 * 1000));

        const proposalMessage: ProposalMessage = {
            from: authorAddress.toLowerCase(),
            space: "parallel-society",
            timestamp: body.timestamp,
            type: "single-choice",
            title: body.title,
            body: body.description,
            discussion: "",
            choices: ["For", "Against"],
            start: Math.floor(startTimeVal / 1000),
            end: Math.floor(endTimeVal / 1000),
            snapshot: body.snapshotBlock, // Use the snapshot signed by the user
            plugins: "{}",
            app: "parallel"
        };

        try {
            const recoveredAddress = await verifyProposalSignature(proposalMessage, body.signature);
            if (recoveredAddress.toLowerCase() !== authorAddress.toLowerCase()) {
                console.warn(`Signature mismatch: ${recoveredAddress} !== ${authorAddress}`);
                res.status(401).json({ error: 'Signature does not match authenticated user' });
                return;
            }
        } catch (sigError: any) {
            console.error('Signature verification failed:', sigError.message);
            res.status(400).json({ error: 'Invalid proposal signature' });
            return;
        }

        // 6. Set Times
        const now = admin.firestore.Timestamp.now();
        const startTime = admin.firestore.Timestamp.fromMillis(startTimeVal);
        const endTime = admin.firestore.Timestamp.fromMillis(endTimeVal);

        // 7. Create Proposal Object
        const proposal: Proposal = {
            title: body.title,
            category: body.category,
            description: body.description,
            authorAddress: authorAddress.toLowerCase(),
            createdAt: now,
            startTime,
            endTime,
            status: 'ACTIVE',
            totalForRaw: '0',
            totalAgainstRaw: '0',
            tokenPowerVotedRaw: '0',
            totalVoters: 0,
            snapshotBlock,
            snapshotChainId: 30, // RSK Mainnet
            strategy: 'lut-erc20-balance@block',
            proposalCidStatus: 'pending',
            signature: body.signature,
            messageHash: body.messageHash,
            timestamp: body.timestamp
        };

        console.log('Adding proposal to Firestore...');
        const docRef = await db.collection('proposals').add(proposal);
        const proposalId = docRef.id;
        console.log(`Proposal created in Firestore with ID: ${proposalId}`);

        // 8. IPFS Pinning
        try {
            console.log(`[createProposal] Preparing IPFS envelope...`);
            const envelope = {
                address: authorAddress.toLowerCase(),
                sig: body.signature,
                hash: body.messageHash,
                data: {
                    domain: EIP712_DOMAIN,
                    types: {
                        Proposal: EIP712_TYPES.Proposal
                    },
                    message: proposalMessage
                }
            };

            console.log(`[createProposal] Calling ipfsRpc.pinJson for proposal: ${proposalId}`);
            const cid = await ipfsRpc.pinJson(envelope);
            console.log(`[createProposal] Proposal CID generated: ${cid}`);

            await db.collection('proposals').doc(proposalId).update({
                proposalCid: cid,
                proposalCidPinnedAt: admin.firestore.Timestamp.now(),
                proposalCidStatus: 'pinned'
            });
            console.log(`[createProposal] Firestore updated with CID for ${proposalId}`);
        } catch (ipfsError: any) {
            console.error(`[createProposal] IPFS pinning CRITICAL failure for ${proposalId}:`, ipfsError.message);
            if (ipfsError.stack) console.error(ipfsError.stack);

            await db.collection('proposals').doc(proposalId).update({
                proposalCidStatus: 'failed',
                ipfsError: ipfsError.message // Store error for debugging
            });
        }

        res.status(201).json({
            id: proposalId,
            ...proposal,
            createdAt: now.toMillis(),
            startTime: startTime.toMillis(),
            endTime: endTime.toMillis()
        });

    } catch (error: any) {
        console.error('Unexpected error in createProposal:', error);
        res.status(500).json({ error: error.message || 'An unexpected error occurred' });
    }
});
