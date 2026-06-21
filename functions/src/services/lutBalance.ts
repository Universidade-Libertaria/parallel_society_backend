import { ethers } from 'ethers';
import { CONFIG } from '../config';

export const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);

const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

export async function getLUTBalanceRaw(address: string): Promise<string> {
    if (!CONFIG.LUT_TOKEN_ADDRESS) {
        console.error("LUT_TOKEN_ADDRESS is not configured in .env");
        throw new Error("Backend configuration error: LUT_TOKEN_ADDRESS missing");
    }

    try {
        const contract = new ethers.Contract(CONFIG.LUT_TOKEN_ADDRESS, ERC20_ABI, provider);
        const balanceBN = await contract.balanceOf(address);
        return balanceBN.toString();
    } catch (error: any) {
        console.error("Error fetching LUT balance from RSK:", error.message);
        throw new Error("Failed to verify LUT balance. Please ensure the RSK network is accessible.");
    }
}


export async function getBalanceAtBlock(address: string, blockTag: number | string): Promise<string> {
    if (!CONFIG.LUT_TOKEN_ADDRESS) {
        throw new Error("Backend configuration error: LUT_TOKEN_ADDRESS missing");
    }
    try {
        console.log(`[getBalanceAtBlock] Fetching for ${address} at tag: ${blockTag}`);
        const contract = new ethers.Contract(CONFIG.LUT_TOKEN_ADDRESS, ERC20_ABI, provider);
        // Pass blockTag in overrides
        const balanceBN = await contract.balanceOf(address, { blockTag });
        console.log(`[getBalanceAtBlock] Result: ${balanceBN.toString()}`);
        return balanceBN.toString();
    } catch (error: any) {
        console.error(`Error fetching LUT balance at block ${blockTag}:`, error.message);
        throw new Error("Failed to fetch historical balance. RPC may not support this snapshot.");
    }
}

export async function getLUTBalance(address: string): Promise<number> {
    const raw = await getLUTBalanceRaw(address);
    return parseFloat(ethers.formatUnits(raw, CONFIG.LUT_TOKEN_DECIMALS));
}
