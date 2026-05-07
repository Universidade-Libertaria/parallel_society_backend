// Define environment variables BEFORE any imports happen
process.env.LUT_TOKEN_ADDRESS = '0xMockTokenAddress';
process.env.LUT_TOKEN_DECIMALS = '18';
process.env.RSK_RPC_URL = 'http://localhost:8545';

// Mock ethers
jest.mock('ethers', () => {
    const originalEthers = jest.requireActual('ethers');
    return {
        ...originalEthers,
        ethers: {
            ...originalEthers.ethers,
            JsonRpcProvider: jest.fn().mockImplementation(() => ({})),
            Contract: jest.fn().mockImplementation(() => ({
                balanceOf: jest.fn().mockResolvedValue(1000000000000000000n) // 1 LUT with 18 decimals
            }))
        }
    };
});

describe('lutBalance Service', () => {
    let lutBalanceModule: any;

    beforeAll(() => {
        // Use require to ensure the module is evaluated AFTER process.env is set
        lutBalanceModule = require('../../services/lutBalance');
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getLUTBalanceRaw', () => {
        it('should return the raw balance string', async () => {
             const balance = await lutBalanceModule.getLUTBalanceRaw('0x1234567890123456789012345678901234567890');
             expect(balance).toBe('1000000000000000000');
        });
    });

    describe('getBalanceAtBlock', () => {
        it('should fetch balance at specific block tag', async () => {
             const balance = await lutBalanceModule.getBalanceAtBlock('0x1234567890123456789012345678901234567890', 12345);
             expect(balance).toBe('1000000000000000000');
        });
    });

    describe('getLUTBalance', () => {
        it('should return formatted decimal balance', async () => {
             const balance = await lutBalanceModule.getLUTBalance('0x1234567890123456789012345678901234567890');
             expect(balance).toBe(1);
        });
    });
});
