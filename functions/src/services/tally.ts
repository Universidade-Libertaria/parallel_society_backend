import { db } from '../firebase';


export async function recomputeTally(proposalId: string): Promise<{
    totalForRaw: string;
    totalAgainstRaw: string;
    totalVoters: number;
    tokenPowerVotedRaw: string;
}> {
    const votesSnapshot = await db.collection('votes')
        .where('proposalId', '==', proposalId)
        .get();

    let totalForRaw = BigInt(0);
    let totalAgainstRaw = BigInt(0);
    let totalVoters = votesSnapshot.size;

    votesSnapshot.forEach(doc => {
        const vote = doc.data();
        let weight: bigint;
        try {
            weight = BigInt(vote.weightRaw || '0');
        } catch {
            console.warn(`[tally] Invalid weightRaw for vote ${doc.id}: "${vote.weightRaw}", skipping.`);
            totalVoters--;
            return; // skip this vote
        }
        if (vote.choice === 'FOR') {
            totalForRaw += weight;
        } else if (vote.choice === 'AGAINST') {
            totalAgainstRaw += weight;
        }
    });

    const tokenPowerVotedRaw = (totalForRaw + totalAgainstRaw).toString();

    return {
        totalForRaw: totalForRaw.toString(),
        totalAgainstRaw: totalAgainstRaw.toString(),
        totalVoters,
        tokenPowerVotedRaw
    };
}
