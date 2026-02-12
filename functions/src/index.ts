import { requestNonce } from './auth/requestNonce';
import { verify } from './auth/verifySignature';
import { checkUsername } from './auth/checkUsername';
import { createProposal } from './proposals/createProposal';
import { listProposals } from './proposals/listProposals';
import { getProposal } from './proposals/getProposal';

import { importSnapshot } from './proposals/importSnapshot';
import { deleteProposal } from './proposals/deleteProposal';
import { voteOnProposal } from './proposals/voteOnProposal';
import { addProposalUpdate } from './proposals/addProposalUpdate';
import { getProposalUpdates } from './proposals/getProposalUpdates';

// Phase 1: Lifecycle transitions
import { publishProposal } from './proposals/publishProposal';
import { startProposalVote } from './proposals/startProposalVote';
import { cancelProposal } from './proposals/cancelProposal';

// Phase 2: Scheduled functions
import { checkDiscussionEnd, checkVotingEnd, checkLegacyActivation } from './proposals/scheduledTransitions';

// Phase 3 & 4: Comments
import { getProposalComments } from './proposals/getProposalComments';
import { addProposalComment } from './proposals/addProposalComment';
import { voteOnComment } from './proposals/voteOnComment';
import { hideComment } from './proposals/hideComment';
import { reportComment } from './proposals/reportComment';

// Phase 5: Editing & Revisions
import { editProposal } from './proposals/editProposal';
import { getProposalRevisions } from './proposals/getProposalRevisions';

// Phase 6: Implementation Updates (edit/delete)
import { editProposalUpdate } from './proposals/editProposalUpdate';
import { deleteProposalUpdate } from './proposals/deleteProposalUpdate';

// Export functions to be deployed
export const authRequestNonce = requestNonce;
export const authVerify = verify;
export const authCheckUsername = checkUsername;

// Proposals — core
export { createProposal, listProposals, getProposal, importSnapshot, deleteProposal, voteOnProposal };

// Proposals — lifecycle
export { publishProposal, startProposalVote, cancelProposal };

// Proposals — scheduled
export { checkDiscussionEnd, checkVotingEnd, checkLegacyActivation };

// Proposals — comments
export { getProposalComments, addProposalComment, voteOnComment, hideComment, reportComment };

// Proposals — editing & revisions
export { editProposal, getProposalRevisions };

// Proposals — implementation updates
export { addProposalUpdate, getProposalUpdates, editProposalUpdate, deleteProposalUpdate };
