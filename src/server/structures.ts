import { findMachine } from "../shared/catalog";
import { CELL_SIZE, placementCenter } from "../shared/grid";
import {
	STRUCTURE_CX,
	STRUCTURE_CZ,
	STRUCTURE_ID,
	STRUCTURE_MACHINE,
	STRUCTURE_OWNER,
	STRUCTURE_ROTATION,
	STRUCTURES_FOLDER,
} from "../shared/protocol";
import type { Structure } from "./buildings";

const workspace = game.GetService("Workspace");
const models = new Map<number, Model>();

const container = new Instance("Folder");
container.Name = STRUCTURES_FOLDER;
container.Parent = workspace;

function block(model: Model, name: string, size: Vector3, cframe: CFrame, color: Color3, material: Enum.Material) {
	const part = new Instance("Part");
	part.Name = name;
	part.Anchored = true;
	part.Size = size;
	part.CFrame = cframe;
	part.Color = color;
	part.Material = material;
	part.Parent = model;
	return part;
}

/** Representação com primitivas. A faixa clara marca a frente da máquina. */
export function showStructure(structure: Structure) {
	const machine = findMachine(structure.machine);
	assert(machine, `Máquina desconhecida: ${structure.machine}.`);
	const model = new Instance("Model");
	model.Name = machine.name;
	model.SetAttribute(STRUCTURE_ID, structure.id);
	model.SetAttribute(STRUCTURE_OWNER, structure.ownerId);
	model.SetAttribute(STRUCTURE_MACHINE, structure.machine);
	model.SetAttribute(STRUCTURE_CX, structure.cx);
	model.SetAttribute(STRUCTURE_CZ, structure.cz);
	model.SetAttribute(STRUCTURE_ROTATION, structure.rotation);

	const origin = new CFrame(placementCenter(machine, structure)).mul(CFrame.Angles(0, (-structure.rotation * math.pi) / 2, 0));
	const width = machine.width * CELL_SIZE - 0.3;
	const depth = machine.depth * CELL_SIZE - 0.3;
	const dark = Color3.fromRGB(58, 66, 76);
	const base = math.min(machine.height, 0.6);
	model.PrimaryPart = block(model, "Base", new Vector3(width, base, depth), origin.mul(new CFrame(0, base / 2, 0)), dark, Enum.Material.Metal);
	if (machine.height > 1) {
		const bodyHeight = machine.height - base;
		const body = new Vector3(width * 0.86, bodyHeight, depth * 0.86);
		block(model, "Corpo", body, origin.mul(new CFrame(0, base + bodyHeight / 2, 0)), machine.color, Enum.Material.Metal);
	} else {
		const top = new Vector3(width * 0.8, 0.2, depth);
		block(model, "Faixa", top, origin.mul(new CFrame(0, machine.height - 0.1, 0)), machine.color, Enum.Material.DiamondPlate);
	}
	const marker = new Vector3(width * 0.5, 0.15, 0.6);
	block(model, "Frente", marker, origin.mul(new CFrame(0, machine.height + 0.05, -depth / 2 + 0.5)), Color3.fromRGB(228, 232, 237), Enum.Material.Neon);

	model.Parent = container;
	models.set(structure.id, model);
}

export function hideStructure(id: number) {
	models.get(id)?.Destroy();
	models.delete(id);
}
