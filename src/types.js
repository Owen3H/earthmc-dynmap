/** THIS FILE CONTAINS ALL TYPES FOR DEVELOPMENT AND IT IS NOT INCLUDED IN THE FINAL BUNDLE */

// --------------------- GEOMETRY TYPES ---------------------
/** @typedef {{x: number, z: number}} Vertex */
/** @typedef {Array<{x: number, z: number}>} Polygon */
/** @typedef {Array<Array<{x: number, z: number}>>} MarkerPoints */
/** @typedef {Array<Array<Array<{x: number, z: number}>>>} MultiPolygonPoints */

// --------------------- ALLIANCE TYPES ---------------------
/** @typedef {{fill: string, outline: string}} AllianceColours */
/** @typedef {{name: string, modeType: string, nations: Array<string>, colours: AllianceColours}} CachedAlliance */

// --------------------- RESPONSE TYPES ---------------------
/**
 * @typedef {Object} ServerInfo
 * @property {string} version
 * @property {string} moonPhase
 * @property {ServerTimestamps} timestamps
 * @property {ServerStatus} status
 * @property {ServerStats} stats
 * @property {ServerVoteParty} voteParty
 */

/**
 * @typedef {Object} ServerTimestamps
 * @property {number} newDayTime
 * @property {number} serverTimeOfDay
 */

/**
 * @typedef {Object} ServerStatus
 * @property {boolean} hasStorm
 * @property {boolean} isThundering
 */

/**
 * @typedef {Object} ServerStats
 * @property {number} time
 * @property {number} fullTime
 * @property {number} maxPlayers
 * @property {number} numOnlinePlayers
 * @property {number} numOnlineNomads
 * @property {number} numResidents
 * @property {number} numNomads
 * @property {number} numTowns
 * @property {number} numTownBlocks
 * @property {number} numNations
 * @property {number} numQuarters
 * @property {number} numCuboids
 */

/**
 * @typedef {Object} ServerVoteParty
 * @property {number} target
 * @property {number} numRemaining
 */