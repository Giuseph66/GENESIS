import type { Flat } from "../shared/combat";

export type RoomKind = "entry" | "encounter" | "upgrade" | "depot" | "boss" | "extraction";

/** Encaixe na borda. Lados: 0 = -Z, 1 = +X, 2 = +Z, 3 = -X. */
export interface Socket {
	readonly side: number;
	/** Deslocamento ao longo da borda, a partir do centro. */
	readonly offset: number;
	readonly width: number;
}

export interface Cover {
	readonly x: number;
	readonly z: number;
	readonly width: number;
	readonly depth: number;
	readonly height: number;
}

/** Módulo de sala em coordenadas locais, com o centro na origem e o piso em Y = 0. */
export interface RoomTemplate {
	readonly id: string;
	readonly version: number;
	readonly kind: RoomKind;
	readonly width: number;
	readonly depth: number;
	readonly entry?: Socket;
	readonly exits: ReadonlyArray<Socket>;
	readonly covers: ReadonlyArray<Cover>;
	readonly spawns: ReadonlyArray<Flat>;
	/** Pontos de recurso, melhoria, chefe ou extração. */
	readonly points: ReadonlyArray<Flat>;
}

const DOOR = 14;
const SOUTH: Socket = { side: 2, offset: 0, width: DOOR };
const NORTH: Socket = { side: 0, offset: 0, width: DOOR };
const EAST: Socket = { side: 1, offset: 0, width: DOOR };
const WEST: Socket = { side: 3, offset: 0, width: DOOR };

function cover(x: number, z: number, width: number, depth: number, height = 9): Cover {
	return { x, z, width, depth, height };
}

export const CATALOG_VERSION = 1;

export const TEMPLATES: ReadonlyArray<RoomTemplate> = [
	{
		id: "entry_dock",
		version: 1,
		kind: "entry",
		width: 44,
		depth: 44,
		exits: [NORTH, EAST, WEST],
		covers: [],
		spawns: [],
		points: [{ x: 0, z: 10 }],
	},
	{
		id: "encounter_hall",
		version: 1,
		kind: "encounter",
		width: 68,
		depth: 68,
		entry: SOUTH,
		exits: [NORTH, EAST, WEST],
		covers: [cover(-15, 12, 8, 4), cover(15, 12, 8, 4), cover(0, -8, 6, 6)],
		spawns: [
			{ x: -20, z: -18 },
			{ x: 20, z: -18 },
			{ x: -12, z: -3 },
			{ x: 13, z: -2 },
		],
		points: [{ x: 22, z: 22 }],
	},
	{
		id: "encounter_pipes",
		version: 1,
		kind: "encounter",
		width: 84,
		depth: 56,
		entry: SOUTH,
		exits: [NORTH, EAST, WEST],
		covers: [cover(-22, -4, 4, 14), cover(22, -4, 4, 14), cover(-10, 4, 5, 5, 7), cover(10, -8, 5, 5, 7)],
		spawns: [
			{ x: -30, z: -14 },
			{ x: 30, z: -14 },
			{ x: -15, z: -14 },
			{ x: 0, z: -4 },
		],
		points: [{ x: -32, z: 18 }],
	},
	{
		id: "encounter_yard",
		version: 1,
		kind: "encounter",
		width: 60,
		depth: 76,
		entry: SOUTH,
		exits: [NORTH, EAST, WEST],
		covers: [cover(-14, 16, 6, 6), cover(14, 4, 6, 6), cover(-12, -16, 10, 4)],
		spawns: [
			{ x: 0, z: -24 },
			{ x: 18, z: -14 },
			{ x: -18, z: -4 },
			{ x: 4, z: -6 },
		],
		points: [{ x: 20, z: 28 }],
	},
	{
		id: "upgrade_bay",
		version: 1,
		kind: "upgrade",
		width: 40,
		depth: 40,
		entry: SOUTH,
		exits: [NORTH, EAST, WEST],
		covers: [],
		spawns: [],
		points: [{ x: 0, z: 0 }],
	},
	{
		id: "depot_cell",
		version: 1,
		kind: "depot",
		width: 40,
		depth: 40,
		entry: SOUTH,
		exits: [],
		covers: [cover(-12, 0, 4, 10), cover(12, 0, 4, 10)],
		spawns: [
			{ x: -6, z: -6 },
			{ x: 6, z: -6 },
		],
		points: [{ x: 0, z: -13 }],
	},
	{
		id: "boss_core",
		version: 1,
		kind: "boss",
		width: 104,
		depth: 104,
		entry: SOUTH,
		exits: [NORTH, EAST, WEST],
		covers: [cover(-28, 18, 6, 6), cover(28, 18, 6, 6), cover(-28, -22, 6, 6), cover(28, -22, 6, 6)],
		spawns: [{ x: 0, z: -22 }],
		points: [{ x: 0, z: 0 }],
	},
	{
		id: "extraction_lift",
		version: 1,
		kind: "extraction",
		width: 40,
		depth: 40,
		entry: SOUTH,
		exits: [],
		covers: [],
		spawns: [],
		points: [{ x: 0, z: -6 }],
	},
];
