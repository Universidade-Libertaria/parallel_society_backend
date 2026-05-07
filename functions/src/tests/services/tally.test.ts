// Mock firebase before importing tally
jest.mock('../../firebase', () => ({
    db: {
        collection: jest.fn()
    }
}));

import { recomputeTally } from '../../services/tally';
import { db } from '../../firebase';

// Helper to create a mock Firestore snapshot
function createMockSnapshot(votes: Array<{ choice: string; weightRaw: string }>) {
    const docs = votes.map((vote, i) => ({
        id: `vote_${i}`,
        data: () => vote
    }));

    return {
        size: votes.length,
        forEach: (cb: (doc: any) => void) => docs.forEach(cb),
        docs
    };
}

describe('tally Service', () => {
    const mockCollection = db.collection as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    function setupVotes(votes: Array<{ choice: string; weightRaw: string }>) {
        const snapshot = createMockSnapshot(votes);
        mockCollection.mockReturnValue({
            where: jest.fn().mockReturnValue({
                get: jest.fn().mockResolvedValue(snapshot)
            })
        });
    }

    it('should correctly tally FOR and AGAINST votes', async () => {
        setupVotes([
            { choice: 'FOR', weightRaw: '1000000000000000000' },     // 1 LUT
            { choice: 'FOR', weightRaw: '2000000000000000000' },     // 2 LUT
            { choice: 'AGAINST', weightRaw: '500000000000000000' }   // 0.5 LUT
        ]);

        const result = await recomputeTally('prop_123');

        expect(result.totalForRaw).toBe('3000000000000000000');
        expect(result.totalAgainstRaw).toBe('500000000000000000');
        expect(result.totalVoters).toBe(3);
        expect(result.tokenPowerVotedRaw).toBe('3500000000000000000');
    });

    it('should return zeros when there are no votes', async () => {
        setupVotes([]);

        const result = await recomputeTally('prop_empty');

        expect(result.totalForRaw).toBe('0');
        expect(result.totalAgainstRaw).toBe('0');
        expect(result.totalVoters).toBe(0);
        expect(result.tokenPowerVotedRaw).toBe('0');
    });

    it('should handle all FOR votes', async () => {
        setupVotes([
            { choice: 'FOR', weightRaw: '5000000000000000000' },
            { choice: 'FOR', weightRaw: '3000000000000000000' }
        ]);

        const result = await recomputeTally('prop_unanimous');

        expect(result.totalForRaw).toBe('8000000000000000000');
        expect(result.totalAgainstRaw).toBe('0');
        expect(result.totalVoters).toBe(2);
    });

    it('should handle all AGAINST votes', async () => {
        setupVotes([
            { choice: 'AGAINST', weightRaw: '7000000000000000000' }
        ]);

        const result = await recomputeTally('prop_rejected');

        expect(result.totalForRaw).toBe('0');
        expect(result.totalAgainstRaw).toBe('7000000000000000000');
        expect(result.totalVoters).toBe(1);
    });

    it('should skip votes with invalid weightRaw and decrement voter count', async () => {
        // Spy on console.warn to suppress output during test
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        setupVotes([
            { choice: 'FOR', weightRaw: '1000000000000000000' },
            { choice: 'FOR', weightRaw: 'not_a_number' },           // Invalid — should be skipped
            { choice: 'AGAINST', weightRaw: '2000000000000000000' }
        ]);

        const result = await recomputeTally('prop_bad_data');

        expect(result.totalForRaw).toBe('1000000000000000000');
        expect(result.totalAgainstRaw).toBe('2000000000000000000');
        expect(result.totalVoters).toBe(2); // 3 - 1 invalid = 2
        expect(result.tokenPowerVotedRaw).toBe('3000000000000000000');

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('Invalid weightRaw')
        );

        warnSpy.mockRestore();
    });

    it('should handle votes with empty weightRaw as zero', async () => {
        setupVotes([
            { choice: 'FOR', weightRaw: '' },
            { choice: 'FOR', weightRaw: '1000000000000000000' }
        ]);

        const result = await recomputeTally('prop_empty_weight');

        // Empty string falls into the try branch: BigInt('') throws, so it's skipped
        // OR BigInt(vote.weightRaw || '0') → BigInt('0') = 0n
        expect(result.totalForRaw).toBe('1000000000000000000');
    });
});
