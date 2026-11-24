import { ITEMS, MachineId, MachineType, requireMachine } from "../shared/catalog";
import { CELL_SIZE, placementCFrame } from "../shared/grid";
import {
	ENERGY_DEMAND,
	ENERGY_GRANTED,
	ENERGY_SUPPLY,
	INPUT_PREFIX,
	OUTPUT_PREFIX,
	Status,
	STOCK_PREFIX,
	STRUCTURE_CX,
	STRUCTURE_CZ,
	STRUCTURE_ENABLED,
	STRUCTURE_ID,
	STRUCTURE_ITEM,
	STRUCTURE_MACHINE,
	STRUCTURE_OWNER,
	STRUCTURE_RESTORED,
	STRUCTURE_ROTATION,
	STRUCTURE_STATUS,
	STRUCTURES_FOLDER,
} from "../shared/protocol";
import type { Structure } from "./buildings";
import type { Energy, MachineState } from "./factory";

const workspace = game.GetService("Workspace");

interface Shown {
	readonly model: Model;
	readonly lamp?: BasePart;
}

const shown = new Map<number, Shown>();
const container = new Instance("Folder");
container.Name = STRUCTURES_FOLDER;
container.Parent = workspace;

const DARK = Color3.fromRGB(58, 66, 76);
const STEEL = Color3.fromRGB(128, 138, 150);
const WHITE = Color3.fromRGB(228, 232, 237);
const CYAN = Color3.fromRGB(56, 201, 232);
const EMBER = Color3.fromRGB(255, 120, 40);

/** A luz repete em cor o que o painel diz em texto. */
const LAMP: { readonly [status in Status]: Color3 } = {
	idle: DARK,
	working: Color3.fromRGB(88, 214, 120),
	off: DARK,
	damaged: Color3.fromRGB(236, 84, 84),
	no_fuel: Color3.fromRGB(236, 84, 84),
	no_power: Color3.fromRGB(236, 84, 84),
	no_input: Color3.fromRGB(255, 190, 60),
	output_full: Color3.fromRGB(255, 190, 60),
};

type Add = (
	name: string,
	size: Vector3,
	offset: CFrame,
	color: Color3,
	material?: Enum.Material,
	shape?: Enum.PartType,
) => Part;

/** Cilindros do Roblox apontam para X. Isto os deixa em pé. */
const UPRIGHT = CFrame.Angles(0, 0, math.pi / 2);

/** Silhuetas com primitivas. A frente, por onde os itens saem, aponta para -Z. */
const BODIES: { readonly [id in MachineId]: (add: Add, width: number, depth: number, machine: MachineType) => void } = {
	miner: (add, width, depth, machine) => {
		for (const x of [-1, 1]) {
			for (const z of [-1, 1]) {
				add("Perna", new Vector3(0.6, 5, 0.6), new CFrame(x * width * 0.4, 3, z * depth * 0.4), machine.color);
			}
		}
		add("Plataforma", new Vector3(width * 0.95, 0.6, depth * 0.95), new CFrame(0, 5.4, 0), machine.color);
		add("Motor", new Vector3(3, 2, 3), new CFrame(0, 6.6, 0), STEEL, Enum.Material.DiamondPlate);
		add("Broca", new Vector3(5.4, 1.6, 1.6), new CFrame(0, 3, 0).mul(UPRIGHT), STEEL, Enum.Material.Metal, Enum.PartType.Cylinder);
		add("Ponta", new Vector3(1, 2.4, 2.4), new CFrame(0, 0.9, 0).mul(UPRIGHT), DARK, Enum.Material.Metal, Enum.PartType.Cylinder);
		add("Calha", new Vector3(2, 0.4, 2), new CFrame(0, 1, -depth * 0.36), STEEL);
	},
	belt: (add, width, depth, machine) => {
		add("Lona", new Vector3(width * 0.7, 0.2, depth), new CFrame(0, machine.height - 0.1, 0), Color3.fromRGB(44, 48, 54), Enum.Material.DiamondPlate);
		for (const x of [-1, 1]) {
			add("Guia", new Vector3(0.4, 0.5, depth), new CFrame(x * width * 0.42, machine.height, 0), machine.color);
		}
		for (const z of [0.8, 0, -0.8]) {
			add("Seta", new Vector3(0.9, 0.06, 0.25), new CFrame(0, machine.height + 0.02, z), Color3.fromRGB(255, 190, 60), Enum.Material.Neon);
		}
	},
	furnace: (add, width, depth, machine) => {
		add("Forno", new Vector3(width * 0.9, 3.6, depth * 0.9), new CFrame(0, 2.4, 0), machine.color, Enum.Material.Brick);
		add("Boca", new Vector3(2.4, 1.6, 0.4), new CFrame(0, 1.9, -depth * 0.44), EMBER, Enum.Material.Neon);
		add("Entrada", new Vector3(2.4, 1.6, 0.4), new CFrame(0, 1.9, depth * 0.44), DARK);
		add("Cinta", new Vector3(width * 0.94, 0.4, depth * 0.94), new CFrame(0, 4, 0), DARK);
		add("Chaminé", new Vector3(4, 1.6, 1.6), new CFrame(width * 0.22, 6, depth * 0.2).mul(UPRIGHT), DARK, Enum.Material.Metal, Enum.PartType.Cylinder);
	},
	assembler: (add, width, depth, machine) => {
		add("Bancada", new Vector3(width * 0.92, 1.4, depth * 0.9), new CFrame(0, 1.3, 0), STEEL);
		for (const x of [-1, 1]) {
			add("Coluna", new Vector3(1, 4, depth * 0.8), new CFrame(x * width * 0.4, 3.6, 0), machine.color);
		}
		add("Ponte", new Vector3(width * 0.86, 0.8, 1.6), new CFrame(0, 5.4, 0), machine.color);
		add("Braço", new Vector3(0.7, 2.6, 0.7), new CFrame(-1, 4, 0), DARK);
		add("Solda", new Vector3(0.5, 0.5, 0.5), new CFrame(-1, 2.6, 0), CYAN, Enum.Material.Neon, Enum.PartType.Ball);
		add("Peça", new Vector3(1.6, 0.5, 1.6), new CFrame(0.8, 2.2, 0), WHITE);
	},
	storage: (add, width, depth, machine) => {
		add("Caixa", new Vector3(width * 0.94, 3.4, depth * 0.94), new CFrame(0, 2.3, 0), machine.color, Enum.Material.CorrodedMetal);
		for (const x of [-0.46, 0, 0.46]) {
			add("Reforço", new Vector3(0.5, 3.6, depth * 0.98), new CFrame(x * width, 2.3, 0), DARK);
		}
		add("Tampa", new Vector3(width * 0.98, 0.4, depth * 0.98), new CFrame(0, 4.1, 0), DARK);
		add("Etiqueta", new Vector3(2.2, 1, 0.2), new CFrame(0, 2.6, -depth * 0.48), WHITE);
	},
	generator: (add, width, depth, machine) => {
		add("Bloco", new Vector3(width * 0.86, 2.6, depth * 0.86), new CFrame(0, 1.9, 0), machine.color);
		const coil = new Vector3(depth * 0.7, 2.6, 2.6);
		add("Turbina", coil, new CFrame(0, 4, 0).mul(CFrame.Angles(0, math.pi / 2, 0)), STEEL, Enum.Material.Metal, Enum.PartType.Cylinder);
		for (const z of [-0.22, 0, 0.22]) {
			const ring = new CFrame(0, 4, z * depth).mul(CFrame.Angles(0, math.pi / 2, 0));
			add("Anel", new Vector3(0.5, 3, 3), ring, CYAN, Enum.Material.Neon, Enum.PartType.Cylinder);
		}
		add("Escape", new Vector3(3.4, 0.9, 0.9), new CFrame(width * 0.3, 5, depth * 0.36).mul(UPRIGHT), DARK, Enum.Material.Metal, Enum.PartType.Cylinder);
	},
};

/** A comparação evita o custo da chamada quando nada mudou. */
function set(instance: Instance, name: string, value: string | number | boolean) {
	if (instance.GetAttribute(name) !== value) instance.SetAttribute(name, value);
}

export function showStructure(structure: Structure) {
	const machine = requireMachine(structure.machine);
	const model = new Instance("Model");
	model.Name = machine.name;
	model.SetAttribute(STRUCTURE_ID, structure.id);
	model.SetAttribute(STRUCTURE_OWNER, structure.ownerId);
	model.SetAttribute(STRUCTURE_MACHINE, structure.machine);
	model.SetAttribute(STRUCTURE_CX, structure.cx);
	model.SetAttribute(STRUCTURE_CZ, structure.cz);
	model.SetAttribute(STRUCTURE_ROTATION, structure.rotation);

	const origin = placementCFrame(machine, structure);
	const width = machine.width * CELL_SIZE - 0.3;
	const depth = machine.depth * CELL_SIZE - 0.3;
	const add: Add = (name, size, offset, color, material = Enum.Material.Metal, shape = Enum.PartType.Block) => {
		const part = new Instance("Part");
		part.Name = name;
		part.Anchored = true;
		part.Shape = shape;
		part.Size = size;
		part.CFrame = origin.mul(offset);
		part.Color = color;
		part.Material = material;
		part.Parent = model;
		return part;
	};

	const base = math.min(machine.height, 0.6);
	model.PrimaryPart = add("Base", new Vector3(width, base, depth), new CFrame(0, base / 2, 0), DARK);
	BODIES[machine.id](add, width, depth, machine);
	let lamp: Part | undefined;
	if (machine.id !== "belt") {
		add("Frente", new Vector3(width * 0.4, 0.15, 0.5), new CFrame(0, base + 0.05, -depth / 2 + 0.3), WHITE, Enum.Material.Neon);
		if (machine.id !== "storage") {
			lamp = add("Luz", new Vector3(0.8, 0.8, 0.8), new CFrame(-width * 0.4, machine.height + 0.6, depth * 0.36), DARK, Enum.Material.Neon, Enum.PartType.Ball);
		}
	}

	model.Parent = container;
	shown.set(structure.id, { model, lamp });
}

export function hideStructure(id: number) {
	shown.get(id)?.model.Destroy();
	shown.delete(id);
}

/** Espelha o estado da simulação em atributos, que o motor replica só quando mudam. */
export function publishState(id: number, state: MachineState) {
	const entry = shown.get(id);
	if (!entry) return;
	const { model, lamp } = entry;
	if (lamp && model.GetAttribute(STRUCTURE_STATUS) !== state.status) lamp.Color = LAMP[state.status];
	set(model, STRUCTURE_STATUS, state.status);
	set(model, STRUCTURE_ENABLED, state.enabled);
	set(model, STRUCTURE_RESTORED, state.restored);
	set(model, STRUCTURE_ITEM, state.item ?? "");
	for (const item of ITEMS) {
		set(model, INPUT_PREFIX + item.id, state.input[item.id] ?? 0);
		set(model, OUTPUT_PREFIX + item.id, state.output[item.id] ?? 0);
		set(model, STOCK_PREFIX + item.id, state.stock[item.id] ?? 0);
	}
}

export function publishEnergy(energy: Energy) {
	set(container, ENERGY_SUPPLY, energy.supply);
	set(container, ENERGY_DEMAND, energy.demand);
	set(container, ENERGY_GRANTED, energy.granted);
}
