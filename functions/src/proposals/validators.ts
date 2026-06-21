import { CreateProposalRequest } from '../types';

export function validateProposalBody(body: CreateProposalRequest): { valid: boolean; error?: string } {
    if (!body) {
        return { valid: false, error: 'Missing request body' };
    }

    const requiredFields = [
        'title',
        'category',
        'description',
        'signature',
        'messageHash',
        'timestamp',
        'snapshotBlock'
    ];

    for (const field of requiredFields) {
        if (!body[field as keyof CreateProposalRequest]) {
            return { valid: false, error: `Missing required field: ${field}` };
        }
    }

    return { valid: true };
}
