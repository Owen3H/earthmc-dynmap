/** THIS FILE CONTAINS ALL TYPES FOR DEVELOPMENT AND IT IS NOT INCLUDED IN THE FINAL BUNDLE */

declare global {
    // --------------------- GEOMETRY TYPES ---------------------
    export interface Vertex { x: number, z: number }
    export type Polygon = Vertex[]
    export type MarkerPoints = Polygon[]
    export type MultiPolygonPoints = MarkerPoints[]

    // --------------------- ALLIANCE TYPES ---------------------
    export interface AllianceColours {
        fill: string
        outline: string
    }

    export interface CachedAlliance {
        name: string
        modeType: string
        nations: string[]
        colours: AllianceColours
    }

    // --------------------- RESPONSE TYPES ---------------------
    export interface ServerInfo {
        version: string
        moonPhase: string
        timestamps: ServerTimestamps
        status: ServerStatus
        stats: ServerStats
        voteParty: ServerVoteParty
    }

    export interface ServerTimestamps {
        newDayTime: number
        serverTimeOfDay: number
    }

    export interface ServerStatus {
        hasStorm: boolean
        isThundering: boolean
    }

    export interface ServerStats {
        time: number
        fullTime: number
        maxPlayers: number
        numOnlinePlayers: number
        numOnlineNomads: number
        numResidents: number
        numNomads: number
        numTowns: number
        numTownBlocks: number
        numNations: number
        numQuarters: number
        numCuboids: number
    }

    export interface ServerVoteParty {
        target: number
        numRemaining: number
    }
}

export {}