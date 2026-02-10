/** THIS FILE CONTAINS ALL TYPES FOR DEVELOPMENT AND IT IS NOT INCLUDED IN THE FINAL BUNDLE */

declare global {
    // --------------------- BUILD SCRIPT TYPES ---------------------
    export interface Manifest {
        [key: string]: any
        name: string
        version: string
        description: string
        author: string
        content_scripts: Array<{
            matches: string[],
            js: string[]
        }>
    }

    export interface Border { x: Array<number>, y: Array<number>, z: Array<number> }
    export interface Borders { [key: string]: Border }

    // --------------------- GEOMETRY TYPES ---------------------
    export interface Vertex { x: number, z: number }
    export type Polygon = Vertex[]
    export type MarkerPoints = Polygon[]
    export type MultiPolygonPoints = MarkerPoints[]

    export interface Marker {
        tooltip: string,
        popup: string,
        color: string,
        fillColor: string,
        weight: number,
        type: string
    }
    
    export interface SquaremapMarker extends Marker {
        points: MultiPolygonPoints
    }

    export interface DynmapMarker extends Marker {
        points: Polygon
    }

    export interface ParsedMarker {
        townName: string,
        nationName: string,
        residentList: string[],
        residentNum: number,
        isCapital: boolean,
        area: number,
        mayor?: string
    }

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