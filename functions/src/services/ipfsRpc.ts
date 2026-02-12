import axios from 'axios';

const RPC_URL = process.env.FILEBASE_IPFS_RPC || 'https://rpc.filebase.io';
const API_KEY = process.env.FILEBASE_API_KEY?.trim();

/**
 * IPFS Service for Filebase RPC
 */
export const ipfsRpc = {
    /**
     * Adds JSON content to IPFS
     */
    async addJson(json: any): Promise<string> {
        if (!API_KEY) {
            console.error('[ipfsRpc] Missing Filebase API Key');
            throw new Error('Filebase API Key (token) not configured');
        }

        console.log(`[ipfsRpc] IPFS config: URL=${RPC_URL}, KeyConfigured=true`);

        const content = JSON.stringify(json);
        const formData = new FormData();
        const blob = new Blob([content], { type: 'application/json' });
        // Filebase/IPFS often expects the field to be named 'file' or 'path'
        formData.append('file', blob, 'proposal.json');

        try {
            console.log(`[ipfsRpc] Adding JSON to IPFS (using fetch)...`);
            // Using fetch instead of axios for better native FormData support in Node 20
            const response = await fetch(`${RPC_URL}/api/v0/add`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                },
                body: formData as any
            });

            console.log(`[ipfsRpc] Add response status: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[ipfsRpc] IPFS add failed: ${response.status} ${response.statusText}`, errorText);
                throw new Error(`IPFS gateway returned ${response.status}: ${errorText}`);
            }

            const data = await response.json() as any;
            const cid = data.Hash;

            if (!cid) {
                console.error('[ipfsRpc] No CID in response data:', data);
                throw new Error('No CID returned from IPFS add');
            }

            return cid;
        } catch (error: any) {
            console.error(`[ipfsRpc] IPFS addJson failed:`, error.message);
            throw new Error(`IPFS Add Failed: ${error.message}`);
        }
    },

    /**
     * Pins an existing CID to Filebase
     */
    async pinCid(cid: string): Promise<void> {
        if (!API_KEY) {
            throw new Error('Filebase API Key not configured');
        }

        try {
            console.log(`[ipfsRpc] Pinning CID: ${cid}`);
            const response = await axios.post(`${RPC_URL}/api/v0/pin/add?arg=${encodeURIComponent(cid)}`, null, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                },
            });
            console.log(`[ipfsRpc] Pin response status: ${response.status}`);
        } catch (error: any) {
            const errorData = error.response?.data;
            console.error('[ipfsRpc] IPFS pinCid failed:', errorData || error.message);
            throw new Error(`IPFS Pin Failed: ${error.message}${errorData ? ` - ${JSON.stringify(errorData)}` : ''}`);
        }
    },

    /**
     * Adds JSON and pins it immediately
     */
    async pinJson(json: any): Promise<string> {
        const cid = await this.addJson(json);
        await this.pinCid(cid);
        return cid;
    }
};
