import { ethers } from 'ethers';
import { verifySignature } from '../../services/wallet';

describe('wallet Service', () => {
    describe('verifySignature', () => {
        it('should return true for a valid signature', async () => {
            // Generating a real wallet and signing a message to test
            const wallet = ethers.Wallet.createRandom();
            const nonce = '123456';
            const message = `Sign in to Parallel Society Governance\nNonce: ${nonce}`;
            const signature = await wallet.signMessage(message);

            const isValid = verifySignature(wallet.address, nonce, signature);
            expect(isValid).toBe(true);
        });

        it('should return false for an invalid signature', async () => {
            const wallet1 = ethers.Wallet.createRandom();
            const wallet2 = ethers.Wallet.createRandom();
            
            const nonce = '123456';
            const message = `Sign in to Parallel Society Governance\nNonce: ${nonce}`;
            const signature = await wallet1.signMessage(message);

            // Validating against a different address
            const isValid = verifySignature(wallet2.address, nonce, signature);
            expect(isValid).toBe(false);
        });

        it('should return false if signature is garbage', () => {
             const isValid = verifySignature('0x1234567890123456789012345678901234567890', '123456', 'invalid_signature');
             expect(isValid).toBe(false);
        });
    });
});
