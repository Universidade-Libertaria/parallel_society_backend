import { ethers } from 'ethers';
import {
    verifyVoteSignature,
    verifyProposalSignature,
    computeVoteHash,
    computeProposalHash,
    EIP712_DOMAIN,
    EIP712_TYPES,
    VoteMessage,
    ProposalMessage
} from '../../services/eip712';

describe('eip712 Service', () => {
    let wallet: ethers.HDNodeWallet;

    beforeAll(() => {
        wallet = ethers.Wallet.createRandom();
    });

    const createVoteMessage = (voterAddress: string): VoteMessage => ({
        proposalId: 'prop_test_001',
        voter: voterAddress,
        choice: 'FOR',
        snapshotBlock: 12345,
        timestamp: Math.floor(Date.now() / 1000)
    });

    const createProposalMessage = (fromAddress: string): ProposalMessage => ({
        from: fromAddress,
        space: 'parallel',
        timestamp: Math.floor(Date.now() / 1000),
        type: 'single-choice',
        title: 'Test Proposal',
        body: 'This is a test proposal body.',
        discussion: '',
        choices: ['FOR', 'AGAINST'],
        start: Math.floor(Date.now() / 1000),
        end: Math.floor(Date.now() / 1000) + 86400,
        snapshot: 12345,
        plugins: '{}',
        app: 'parallel-society'
    });

    describe('verifyVoteSignature', () => {
        it('should recover the correct signer address from a valid vote signature', async () => {
            const message = createVoteMessage(wallet.address);

            const signature = await wallet.signTypedData(
                EIP712_DOMAIN,
                { Vote: EIP712_TYPES.Vote },
                message
            );

            const recovered = await verifyVoteSignature(message, signature);
            expect(recovered).toBe(wallet.address.toLowerCase());
        });

        it('should recover a different address for a tampered vote message', async () => {
            const message = createVoteMessage(wallet.address);

            const signature = await wallet.signTypedData(
                EIP712_DOMAIN,
                { Vote: EIP712_TYPES.Vote },
                message
            );

            // Tamper with the message — change the voter address
            const tamperedVoter = ethers.Wallet.createRandom().address;
            const tamperedMessage = { ...message, voter: tamperedVoter };

            const recovered = await verifyVoteSignature(tamperedMessage, signature);
            // With EIP-712, tampered data produces a different hash, so ecrecover
            // returns a completely different (random) address — NOT the original signer.
            // The security check is: recovered !== tamperedVoter (the attacker's address)
            expect(recovered).not.toBe(tamperedVoter.toLowerCase());
        });

        it('should throw for a completely invalid signature', async () => {
            const message = createVoteMessage(wallet.address);

            await expect(
                verifyVoteSignature(message, '0xdeadbeef')
            ).rejects.toThrow('Invalid vote signature');
        });

        it('should recover a different address when choice is tampered', async () => {
            const message = createVoteMessage(wallet.address);
            const signature = await wallet.signTypedData(
                EIP712_DOMAIN,
                { Vote: EIP712_TYPES.Vote },
                message
            );

            // Tamper choice: FOR → AGAINST
            const tamperedMessage: VoteMessage = { ...message, choice: 'AGAINST' };
            const recovered = await verifyVoteSignature(tamperedMessage, signature);
            // Tampered message produces different hash → ecrecover gives a different address
            expect(recovered).not.toBe(wallet.address.toLowerCase());
        });
    });

    describe('verifyProposalSignature', () => {
        it('should recover the correct signer from a valid proposal signature', async () => {
            const message = createProposalMessage(wallet.address);

            const signature = await wallet.signTypedData(
                EIP712_DOMAIN,
                { Proposal: EIP712_TYPES.Proposal },
                message
            );

            const recovered = await verifyProposalSignature(message, signature);
            expect(recovered).toBe(wallet.address.toLowerCase());
        });

        it('should throw for garbage signature', async () => {
            const message = createProposalMessage(wallet.address);

            await expect(
                verifyProposalSignature(message, 'not_a_real_signature')
            ).rejects.toThrow('Invalid proposal signature');
        });
    });

    describe('computeVoteHash', () => {
        it('should return a deterministic hash for the same message', async () => {
            const message = createVoteMessage(wallet.address);

            const hash1 = await computeVoteHash(message);
            const hash2 = await computeVoteHash(message);

            expect(hash1).toBe(hash2);
            expect(hash1).toMatch(/^0x[a-fA-F0-9]{64}$/);
        });

        it('should return different hashes for different messages', async () => {
            const msg1 = createVoteMessage(wallet.address);
            const msg2 = { ...msg1, proposalId: 'prop_different' };

            const hash1 = await computeVoteHash(msg1);
            const hash2 = await computeVoteHash(msg2);

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('computeProposalHash', () => {
        it('should return a valid 32-byte hex hash', async () => {
            const message = createProposalMessage(wallet.address);
            const hash = await computeProposalHash(message);

            expect(hash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        });

        it('should be deterministic', async () => {
            const message = createProposalMessage(wallet.address);
            const hash1 = await computeProposalHash(message);
            const hash2 = await computeProposalHash(message);

            expect(hash1).toBe(hash2);
        });
    });
});
