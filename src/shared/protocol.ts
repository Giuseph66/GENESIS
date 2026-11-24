import type { ItemId, MachineId } from "./catalog";
import type { Grant, Grants, PartyEntry, Role } from "./party";
import type { ResearchState } from "./research";

export const REMOTES_FOLDER = "GenesisRemotes";
/** Cliente → servidor: intenções. */
export const COMMAND_REMOTE = "Command";
/** Servidor → cliente: resultado correlacionado por requestId. */
export const RESULT_REMOTE = "Result";
/** Servidor → cliente: estado do próprio jogador. */
export const STATE_REMOTE = "State";

/** Pasta das construções. Também carrega os atributos de energia. */
export const STRUCTURES_FOLDER = "GenesisStructures";
export const ENERGY_SUPPLY = "EnergySupply";
export const ENERGY_DEMAND = "EnergyDemand";
export const ENERGY_GRANTED = "EnergyGranted";

export const STRUCTURE_ID = "StructureId";
export const STRUCTURE_OWNER = "OwnerId";
export const STRUCTURE_MACHINE = "MachineId";
export const STRUCTURE_CX = "CellX";
export const STRUCTURE_CZ = "CellZ";
export const STRUCTURE_ROTATION = "Rotation";
export const STRUCTURE_STATUS = "Status";
export const STRUCTURE_ENABLED = "Enabled";
export const STRUCTURE_RESTORED = "Restored";
/** Item sobre a esteira, ou texto vazio. */
export const STRUCTURE_ITEM = "Item";
/** Prefixos seguidos do ID do item. */
export const INPUT_PREFIX = "In_";
export const OUTPUT_PREFIX = "Out_";
export const STOCK_PREFIX = "Stock_";

export type Status = "idle" | "working" | "off" | "damaged" | "no_fuel" | "no_power" | "no_input" | "output_full";

interface Placed {
	cx: number;
	cz: number;
	rotation: number;
}

export type Action =
	| ({ kind: "build"; machine: MachineId } & Placed)
	| ({ kind: "move"; structureId: number } & Placed)
	| { kind: "remove"; structureId: number }
	| { kind: "restore"; structureId: number }
	| { kind: "toggle"; structureId: number; enabled: boolean }
	| { kind: "insert"; structureId: number; item: ItemId; amount: number }
	| { kind: "extract"; structureId: number }
	| { kind: "mine"; nodeId: string }
	| { kind: "invite"; userId: number }
	| { kind: "answer"; accept: boolean }
	| { kind: "grant"; userId: number; grant: Grant; enabled: boolean }
	| { kind: "expel"; userId: number };

export type PartyAction = Extract<Action, { kind: "invite" | "answer" | "grant" | "expel" }>;
/** Ações sobre a instalação, resolvidas pelo grid e pelas máquinas. */
export type FacilityAction = Exclude<Action, PartyAction | { kind: "mine" }>;

export type Command = { kind: "sync" } | { kind: "act"; requestId: number; action: Action };

export type Reason =
	| "OK"
	| "INVALID_REQUEST"
	| "RATE_LIMITED"
	| "OUT_OF_BOUNDS"
	| "RESERVED_AREA"
	| "CELL_OCCUPIED"
	| "NO_VEIN"
	| "TOO_FAR"
	| "INSUFFICIENT_ITEMS"
	| "INVENTORY_FULL"
	| "MACHINE_FULL"
	| "NOTHING_TO_TAKE"
	| "TOO_SOON"
	| "DEPLETED"
	| "MISSING_PREREQUISITE"
	| "RESEARCH_BUSY"
	| "ALREADY_DONE"
	| "WORLD_UNAVAILABLE"
	| "SECTOR_LOCKED"
	| "NOT_MEMBER"
	| "PARTY_FULL"
	| "INVITE_EXPIRED"
	| "NOT_FOUND"
	| "NOT_AUTHORIZED";

export interface CommandResult {
	readonly requestId: number;
	readonly reason: Reason;
}

/** Atributo do Workspace lido pela tela de carregamento. Vazio quando o mundo está pronto. */
export const WORLD_STATUS = "GenesisWorldStatus";

export interface PlayerState {
	readonly revision: number;
	readonly suppliesReady: boolean;
	readonly generatorRestored: boolean;
	readonly automationDone: boolean;
	readonly research: ResearchState;
	readonly facts: ReadonlyArray<string>;
	readonly role: Role;
	readonly grants: Grants;
	/** Nome de quem convidou, enquanto o convite valer. */
	readonly invitedBy?: string;
	readonly party: ReadonlyArray<PartyEntry>;
	readonly inventory: { readonly [id in ItemId]: number };
}
