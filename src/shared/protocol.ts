import type { MachineId, ResourceId } from "./catalog";

export const REMOTES_FOLDER = "GenesisRemotes";
/** Cliente → servidor: intenções. */
export const COMMAND_REMOTE = "Command";
/** Servidor → cliente: resultado correlacionado por requestId. */
export const RESULT_REMOTE = "Result";
/** Servidor → cliente: estado do próprio jogador. */
export const STATE_REMOTE = "State";

export const STRUCTURES_FOLDER = "GenesisStructures";
export const STRUCTURE_ID = "StructureId";
export const STRUCTURE_OWNER = "OwnerId";
export const STRUCTURE_MACHINE = "MachineId";
export const STRUCTURE_CX = "CellX";
export const STRUCTURE_CZ = "CellZ";
export const STRUCTURE_ROTATION = "Rotation";

export type Command =
	| { kind: "sync" }
	| { kind: "build"; requestId: number; machine: MachineId; cx: number; cz: number; rotation: number }
	| { kind: "remove"; requestId: number; structureId: number };

export type Reason =
	| "OK"
	| "INVALID_REQUEST"
	| "RATE_LIMITED"
	| "ECHO_OFFLINE"
	| "OUT_OF_BOUNDS"
	| "RESERVED_AREA"
	| "CELL_OCCUPIED"
	| "TOO_FAR"
	| "INSUFFICIENT_ITEMS"
	| "INVENTORY_FULL"
	| "NOT_FOUND"
	| "NOT_AUTHORIZED";

export interface CommandResult {
	readonly requestId: number;
	readonly reason: Reason;
}

export interface PlayerState {
	readonly revision: number;
	readonly echoOnline: boolean;
	readonly suppliesReady: boolean;
	readonly structures: number;
	readonly inventory: { readonly [id in ResourceId]: number };
}
