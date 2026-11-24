export type ResourceId = "iron_ore" | "coal";

export interface ResourceType {
	readonly id: ResourceId;
	readonly name: string;
	/** Quantidade por coleta manual. */
	readonly gather: number;
	/** Quantidade que conclui o objetivo inicial de coleta. */
	readonly goal: number;
}

export const RESOURCES: ReadonlyArray<ResourceType> = [
	{ id: "iron_ore", name: "Minério de ferro", gather: 10, goal: 30 },
	{ id: "coal", name: "Carvão", gather: 2, goal: 6 },
];

/** Limite por recurso no inventário pessoal. */
export const INVENTORY_CAPACITY = 200;

export type MachineId = "miner" | "belt" | "furnace" | "assembler" | "generator" | "storage";

export interface MachineType {
	readonly id: MachineId;
	readonly name: string;
	/** Ocupação em células, antes de girar. */
	readonly width: number;
	readonly depth: number;
	/** Altura em studs. */
	readonly height: number;
	readonly cost: number;
	readonly color: Color3;
}

export const COST_RESOURCE: ResourceId = "iron_ore";

export const MACHINES: ReadonlyArray<MachineType> = [
	{ id: "miner", name: "Mineradora", width: 2, depth: 2, height: 6, cost: 6, color: Color3.fromRGB(255, 150, 51) },
	{ id: "belt", name: "Esteira", width: 1, depth: 1, height: 0.8, cost: 1, color: Color3.fromRGB(120, 130, 142) },
	{ id: "furnace", name: "Fornalha", width: 2, depth: 2, height: 5, cost: 4, color: Color3.fromRGB(196, 92, 62) },
	{ id: "assembler", name: "Montadora", width: 3, depth: 2, height: 5, cost: 6, color: Color3.fromRGB(56, 201, 232) },
	{ id: "generator", name: "Gerador", width: 2, depth: 3, height: 5, cost: 2, color: Color3.fromRGB(232, 200, 72) },
	{ id: "storage", name: "Armazém", width: 2, depth: 2, height: 4, cost: 2, color: Color3.fromRGB(132, 152, 112) },
];

export function findMachine(id: unknown): MachineType | undefined {
	return MACHINES.find((machine) => machine.id === id);
}

export function findResource(id: ResourceId): ResourceType {
	const resource = RESOURCES.find((candidate) => candidate.id === id);
	assert(resource, `Recurso "${id}" ausente no catálogo.`);
	return resource;
}
