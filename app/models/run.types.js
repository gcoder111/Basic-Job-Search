/**
 * @typedef {object} SourceStatus
 * @property {string} sourceId
 * @property {string} displayName
 * @property {string} portalKey
 * @property {string} status
 * @property {string} note
 */

/**
 * @typedef {object} OrchestratedRunSummary
 * @property {SourceStatus[]} sourceStatuses
 * @property {object[]} candidateJobs
 * @property {object[]} discardedJobs
 * @property {object[]} selectedJobs
 */

export {};
