// Set environment before imports
process.env.NONCE_EXPIRATION_MS = '300000';

// Mock firebase
jest.mock('../../firebase', () => {
    return {
        db: {
            collection: jest.fn()
        }
    };
});

// Mock firebase-admin for Timestamp
jest.mock('firebase-admin', () => ({
    firestore: {
        Timestamp: {
            fromMillis: jest.fn((ms: number) => ({
                toMillis: () => ms
            }))
        }
    }
}));

// Mock crypto
jest.mock('crypto', () => ({
    randomBytes: jest.fn().mockReturnValue({
        toString: jest.fn().mockReturnValue('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4')
    })
}));

import { db } from '../../firebase';

describe('nonce Service', () => {
    const mockAddress = '0x1234567890123456789012345678901234567890';
    let nonceModule: any;

    // Mock Firestore document operations
    const mockSet = jest.fn().mockResolvedValue(undefined);
    const mockGet = jest.fn();
    const mockDelete = jest.fn().mockResolvedValue(undefined);

    beforeAll(() => {
        // Setup collection mock chain
        (db.collection as jest.Mock).mockReturnValue({
            doc: jest.fn().mockReturnValue({
                set: mockSet,
                get: mockGet,
                delete: mockDelete
            })
        });

        // Import after mocks are set
        nonceModule = require('../../services/nonce');
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // Re-setup the mock chain after clearAllMocks
        (db.collection as jest.Mock).mockReturnValue({
            doc: jest.fn().mockReturnValue({
                set: mockSet,
                get: mockGet,
                delete: mockDelete
            })
        });
    });

    describe('generateNonce', () => {
        it('should generate a nonce and store it in Firestore', async () => {
            const nonce = await nonceModule.generateNonce(mockAddress);

            expect(nonce).toBe('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4');
            expect(db.collection).toHaveBeenCalledWith('auth_nonces');
            expect(mockSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    address: mockAddress,
                    nonce: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
                })
            );
        });

        it('should include expiration timestamp in stored data', async () => {
            await nonceModule.generateNonce(mockAddress);

            const storedData = mockSet.mock.calls[0][0];
            expect(storedData).toHaveProperty('expiresAt');
            expect(storedData).toHaveProperty('createdAt');
        });
    });

    describe('getNonce', () => {
        it('should return the nonce if document exists and not expired', async () => {
            const futureMs = Date.now() + 60000; // expires in 60 seconds
            mockGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    nonce: 'valid_nonce_123',
                    expiresAt: { toMillis: () => futureMs }
                })
            });

            const nonce = await nonceModule.getNonce(mockAddress);
            expect(nonce).toBe('valid_nonce_123');
        });

        it('should return null if document does not exist', async () => {
            mockGet.mockResolvedValue({
                exists: false,
                data: () => null
            });

            const nonce = await nonceModule.getNonce(mockAddress);
            expect(nonce).toBeNull();
        });

        it('should return null if nonce is expired', async () => {
            const pastMs = Date.now() - 60000; // expired 60 seconds ago
            mockGet.mockResolvedValue({
                exists: true,
                data: () => ({
                    nonce: 'expired_nonce_456',
                    expiresAt: { toMillis: () => pastMs }
                })
            });

            const nonce = await nonceModule.getNonce(mockAddress);
            expect(nonce).toBeNull();
        });
    });

    describe('invalidateNonce', () => {
        it('should delete the nonce document from Firestore', async () => {
            await nonceModule.invalidateNonce(mockAddress);

            expect(db.collection).toHaveBeenCalledWith('auth_nonces');
            expect(mockDelete).toHaveBeenCalled();
        });
    });
});
