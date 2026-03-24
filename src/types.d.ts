/** THIS FILE CONTAINS ALL TYPES FOR DEVELOPMENT AND IT IS NOT INCLUDED IN THE FINAL BUNDLE */

declare global {
    // --------------------- BUILD SCRIPT TYPES ---------------------
    export interface Manifest {
        [key: string]: any
        name: string
        version: string
        description: string
        author: string
        browser_specific_settings?: {
            gecko?: {
                id?: string
                strict_min_version?: string
                data_collection_permissions?: {
                    required?: Array<'none' | 'technicalAndInteractionData' | 'browsingActivity' | 'searchTerms'>
                    optional?: Array<'technicalAndInteractionData' | 'browsingActivity' | 'searchTerms'>
                }
            }
        }
        web_accessible_resources: Array<{
            matches: Array<string>
            resources: Array<string>
        } | Array<string>>
        content_scripts: Array<{
            matches: Array<string>,
            run_at?: string,
            css: Array<string>
            js: Array<string>
        }>
    }

    export interface Border { x: Array<number>, y: Array<number>, z: Array<number> }
    export interface Borders { [key: string]: Border }

    // --------------------- GEOMETRY TYPES ---------------------
    export interface Vertex { x: number, z: number }
    export type Polygon = Array<Vertex>
    export type MarkerPoints = Array<Polygon>
    export type MultiPolygonPoints = Array<MarkerPoints>

    /** The raw response data from `markers.json`. Contains markers from Towny at index 0 and World Border at index 1. */
    export type MarkersResponse = Array<ResponseMarker>
    export interface ResponseMarker { 
        // id: string;
        // name: string;
        // timestamp: number
        // control: boolean;
        // z_index: number;
        // order: number;
        // hide: boolean;
        markers: Array<SquaremapMarker | DynmapMarker>;
    }

    export interface Marker {
        tooltip: string
        popup: string
        type: string
        weight: number
        color: string
        opacity: number
        fillColor: string
        fillOpacity: number
    }
    
    export interface SquaremapMarker extends Marker {
        points: MultiPolygonPoints
    }

    export interface DynmapMarker extends Marker {
        points: Polygon
    }

    export interface ParsedMarker {
        townName: string
        nationName: string
        residentList: Array<string>
        residentNum: number
        isCapital: boolean
        area: number
        x: number
        z: number
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
        nations: Array<string>
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

    // --------------------- MISC TYPES ---------------------
    export interface TokenBucketOptions {
        capacity: number
        refillRate: number
        storageKey: string
    }

    export interface TokenBucketStored {
        tokens: number
        lastRefill: number
    }
}

export {}
