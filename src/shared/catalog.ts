export type ItemId = "iron_ore" | "coal" | "iron_bar" | "component" | "ancient_fragment";
export type Counts = { [id in ItemId]?: number };

export interface ItemType {
	readonly id: ItemId;
	readonly name: string;
	readonly color: Color3;
}

export const ITEMS: ReadonlyArray<ItemType> = [
	{ id: "iron_ore", name: "Minério de ferro", color: Color3.fromRGB(176, 132, 108) },
	{ id: "coal", name: "Carvão", color: Color3.fromRGB(40, 42, 46) },
	{ id: "iron_bar", name: "Barra de ferro", color: Color3.fromRGB(196, 204, 212) },
	{ id: "component", name: "Componente", color: Color3.fromRGB(56, 201, 232) },
	{ id: "ancient_fragment", name: "Fragmento antigo", color: Color3.fromRGB(186, 120, 255) },
];

export interface GatherType {
	readonly item: ItemId;
	/** Quantidade por golpe no depósito do posto. */
	readonly amount: number;
	/** Quantidade que conclui o objetivo inicial de coleta. */
	readonly goal: number;
}

export const GATHER: ReadonlyArray<GatherType> = [
	{ item: "iron_ore", amount: 5, goal: 30 },
	{ item: "coal", amount: 1, goal: 6 },
];

/** Limite por item no inventário pessoal. */
export const INVENTORY_CAPACITY = 200;
/** Limite por item nas entradas e saídas de fabricação. */
export const BUFFER_CAPACITY = 4;
export const STORAGE_CAPACITY = 32;
export const FUEL_CAPACITY = 10;
export const FUEL_ITEM: ItemId = "coal";
export const FUEL_SECONDS = 60;
export const COST_ITEM: ItemId = "iron_ore";
export const GENERATOR_RESTORE_COST = 2;

export interface Recipe {
	readonly inputs: Counts;
	readonly outputs: Counts;
	readonly seconds: number;
}

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
	/** Máquinas fixas do cenário não aparecem na barra de construção. */
	readonly buildable: boolean;
	/** Consumo em unidades de energia por segundo durante o lote. */
	readonly power: number;
	/** Geração em unidades de energia por segundo. */
	readonly supply: number;
	readonly needsVein: boolean;
	readonly recipe?: Recipe;
}

export const MACHINES: ReadonlyArray<MachineType> = [
	{
		id: "miner",
		name: "Mineradora",
		width: 2,
		depth: 2,
		height: 6,
		cost: 6,
		color: Color3.fromRGB(255, 150, 51),
		buildable: true,
		power: 5,
		supply: 0,
		needsVein: true,
		recipe: { inputs: {}, outputs: { iron_ore: 1 }, seconds: 2 },
	},
	{
		id: "belt",
		name: "Esteira",
		width: 1,
		depth: 1,
		height: 0.8,
		cost: 1,
		color: Color3.fromRGB(120, 130, 142),
		buildable: true,
		power: 0,
		supply: 0,
		needsVein: false,
	},
	{
		id: "furnace",
		name: "Fornalha",
		width: 2,
		depth: 2,
		height: 5,
		cost: 4,
		color: Color3.fromRGB(196, 92, 62),
		buildable: true,
		power: 10,
		supply: 0,
		needsVein: false,
		recipe: { inputs: { iron_ore: 1 }, outputs: { iron_bar: 1 }, seconds: 3 },
	},
	{
		id: "assembler",
		name: "Montadora",
		width: 3,
		depth: 2,
		height: 5,
		cost: 6,
		color: Color3.fromRGB(56, 201, 232),
		buildable: true,
		power: 10,
		supply: 0,
		needsVein: false,
		recipe: { inputs: { iron_bar: 2 }, outputs: { component: 1 }, seconds: 4 },
	},
	{
		id: "storage",
		name: "Armazém",
		width: 2,
		depth: 2,
		height: 4,
		cost: 2,
		color: Color3.fromRGB(132, 152, 112),
		buildable: true,
		power: 0,
		supply: 0,
		needsVein: false,
	},
	{
		id: "generator",
		name: "Gerador de emergência",
		width: 2,
		depth: 3,
		height: 5,
		cost: 0,
		color: Color3.fromRGB(232, 200, 72),
		buildable: false,
		power: 0,
		supply: 30,
		needsVein: false,
	},
];

export const BUILDABLE: ReadonlyArray<MachineType> = MACHINES.filter((machine) => machine.buildable);

export function findMachine(id: unknown): MachineType | undefined {
	return MACHINES.find((machine) => machine.id === id);
}

export function requireMachine(id: MachineId): MachineType {
	const machine = findMachine(id);
	assert(machine, `Máquina "${id}" ausente no catálogo.`);
	return machine;
}

export function findItem(id: unknown): ItemType | undefined {
	return ITEMS.find((item) => item.id === id);
}

/** Máquina aceita o item como insumo, combustível ou estoque. */
export function acceptsItem(machine: MachineType, item: ItemId): boolean {
	if (machine.id === "storage") return true;
	if (machine.id === "generator") return item === FUEL_ITEM;
	return machine.recipe !== undefined && machine.recipe.inputs[item] !== undefined;
}
