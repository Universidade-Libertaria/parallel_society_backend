import * as admin from 'firebase-admin';

// Mock firebase
jest.mock('../../firebase', () => ({
    db: {
        collection: jest.fn(),
        runTransaction: jest.fn()
    }
}));

// Mock tally
jest.mock('../../services/tally', () => ({
    recomputeTally: jest.fn()
}));

// Mock numbers
jest.mock('../../services/numbers', () => ({
    compareRaw: jest.fn()
}));

// Mock ipfsRpc
jest.mock('../../services/ipfsRpc', () => ({
    ipfsRpc: {
        pinJson: jest.fn()
    }
}));

// Mock firebase-admin
jest.mock('firebase-admin', () => ({
    firestore: {
        Timestamp: {
            now: jest.fn(() => ({
                toMillis: () => Date.now()
            })),
            fromMillis: jest.fn((ms: number) => ({
                toMillis: () => ms
            }))
        }
    }
}));

import { resolveEffectiveStatus } from '../../services/finalize';
import { Proposal } from '../../types';

// Helper to create a mock Proposal
function createMockProposal(overrides: Partial<Proposal> = {}): Proposal {
    return {
        title: 'Test Proposal',
        category: 'Treasury',
        description: 'A test proposal',
        authorAddress: '0x1234',
        createdAt: { toMillis: () => 1000000 },
        startTime: null,
        endTime: null,
        status: 'ACTIVE',
        totalForRaw: '0',
        totalAgainstRaw: '0',
        tokenPowerVotedRaw: '0',
        totalVoters: 0,
        ...overrides
    };
}

describe('finalize Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset Timestamp.now() for each test
        (admin.firestore.Timestamp.now as jest.Mock).mockReturnValue({
            toMillis: () => Date.now()
        });
    });

    describe('resolveEffectiveStatus', () => {
        // --- Terminal statuses ---
        it.each([
            'PASSED', 'FAILED', 'CLOSED', 'ACCEPTED', 'REJECTED', 'CANCELED'
        ])('should return unchanged for terminal status: %s', (status) => {
            const proposal = createMockProposal({ status: status as any });
            const result = resolveEffectiveStatus(proposal);
            expect(result.status).toBe(status);
        });

        // --- New governance statuses ---
        it.each([
            'DRAFT', 'IN_DISCUSSION', 'READY_FOR_VOTING', 'VOTING_ENDED'
        ])('should return unchanged for governance status: %s', (status) => {
            const proposal = createMockProposal({ status: status as any });
            const result = resolveEffectiveStatus(proposal);
            expect(result.status).toBe(status);
        });

        // --- Legacy ACTIVE/VOTING_LIVE ---
        it('should keep ACTIVE status if voting period has not ended', () => {
            const futureEnd = Date.now() + 86400000; // 1 day from now
            const proposal = createMockProposal({
                status: 'ACTIVE',
                endTime: { toMillis: () => futureEnd }
            });

            const result = resolveEffectiveStatus(proposal);
            expect(result.status).toBe('ACTIVE');
        });

        it('should keep ACTIVE status if endTime is null', () => {
            const proposal = createMockProposal({
                status: 'ACTIVE',
                endTime: null
            });

            const result = resolveEffectiveStatus(proposal);
            expect(result.status).toBe('ACTIVE');
        });

        it('should project ACTIVE → VOTING_ENDED if endTime has passed', () => {
            const pastEnd = Date.now() - 60000; // 1 minute ago
            const proposal = createMockProposal({
                status: 'ACTIVE',
                endTime: { toMillis: () => pastEnd }
            });

            const result = resolveEffectiveStatus(proposal);
            expect(result.status).toBe('VOTING_ENDED');
        });

        it('should project VOTING_LIVE → VOTING_ENDED if endTime has passed', () => {
            const pastEnd = Date.now() - 60000;
            const proposal = createMockProposal({
                status: 'VOTING_LIVE',
                endTime: { toMillis: () => pastEnd }
            });

            const result = resolveEffectiveStatus(proposal);
            expect(result.status).toBe('VOTING_ENDED');
        });

        it('should keep VOTING_LIVE if still within voting period', () => {
            const futureEnd = Date.now() + 86400000;
            const proposal = createMockProposal({
                status: 'VOTING_LIVE',
                endTime: { toMillis: () => futureEnd }
            });

            const result = resolveEffectiveStatus(proposal);
            expect(result.status).toBe('VOTING_LIVE');
        });

        // --- Legacy UPCOMING ---
        it('should project UPCOMING → ACTIVE if startTime has passed', () => {
            const pastStart = Date.now() - 60000;
            const proposal = createMockProposal({
                status: 'UPCOMING',
                startTime: { toMillis: () => pastStart }
            });

            const result = resolveEffectiveStatus(proposal);
            expect(result.status).toBe('ACTIVE');
        });

        it('should keep UPCOMING if startTime has not passed', () => {
            const futureStart = Date.now() + 86400000;
            const proposal = createMockProposal({
                status: 'UPCOMING',
                startTime: { toMillis: () => futureStart }
            });

            const result = resolveEffectiveStatus(proposal);
            expect(result.status).toBe('UPCOMING');
        });

        // --- Immutability check ---
        it('should not mutate the original proposal object', () => {
            const pastEnd = Date.now() - 60000;
            const original = createMockProposal({
                status: 'ACTIVE',
                endTime: { toMillis: () => pastEnd }
            });

            const result = resolveEffectiveStatus(original);

            // Result should be a new object
            expect(result).not.toBe(original);
            // Original should be unchanged
            expect(original.status).toBe('ACTIVE');
            // Result should have projected status
            expect(result.status).toBe('VOTING_ENDED');
        });
    });
});
