import * as dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
    CHAIN_ID: 30, // RSK Mainnet
    LUT_TOKEN_ADDRESS: process.env.LUT_TOKEN_ADDRESS || '',
    LUT_TOKEN_DECIMALS: parseInt(process.env.LUT_TOKEN_DECIMALS || '18'),
    NONCE_EXPIRATION_MS: parseInt(process.env.NONCE_EXPIRATION_MS || '300000'),
    RPC_URL: process.env.RSK_RPC_URL || '',
    EIP712: {
        DOMAIN_NAME: 'parallel',
        DOMAIN_VERSION: '1'
    }
};
