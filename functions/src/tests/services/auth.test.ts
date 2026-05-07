// Mock firebase before imports
jest.mock('../../firebase', () => ({
    auth: {
        verifyIdToken: jest.fn()
    }
}));

import { verifyAuthToken } from '../../services/auth';
import { auth } from '../../firebase';

describe('auth Service', () => {
    const mockVerifyIdToken = auth.verifyIdToken as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('verifyAuthToken', () => {
        it('should return uid for a valid Bearer token', async () => {
            mockVerifyIdToken.mockResolvedValue({ uid: '0xABC123' });

            const uid = await verifyAuthToken('Bearer valid_token_123');

            expect(uid).toBe('0xABC123');
            expect(mockVerifyIdToken).toHaveBeenCalledWith('valid_token_123');
        });

        it('should throw if Authorization header is missing', async () => {
            await expect(verifyAuthToken(undefined)).rejects.toThrow(
                'Unauthorized: Missing or invalid Authorization header'
            );
        });

        it('should throw if Authorization header is empty', async () => {
            await expect(verifyAuthToken('')).rejects.toThrow(
                'Unauthorized: Missing or invalid Authorization header'
            );
        });

        it('should throw if Authorization header lacks Bearer prefix', async () => {
            await expect(verifyAuthToken('Basic some_token')).rejects.toThrow(
                'Unauthorized: Missing or invalid Authorization header'
            );
        });

        it('should throw if Firebase token verification fails', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockVerifyIdToken.mockRejectedValue(new Error('Token expired'));

            await expect(verifyAuthToken('Bearer expired_token')).rejects.toThrow(
                'Unauthorized: Invalid or expired token'
            );

            consoleSpy.mockRestore();
        });

        it('should correctly extract token after "Bearer "', async () => {
            mockVerifyIdToken.mockResolvedValue({ uid: '0xDEF456' });

            await verifyAuthToken('Bearer eyJhbGciOiJSUzI1NiJ9.test.signature');

            expect(mockVerifyIdToken).toHaveBeenCalledWith('eyJhbGciOiJSUzI1NiJ9.test.signature');
        });
    });
});
