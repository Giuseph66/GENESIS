import { findMachine, MachineType } from "../shared/catalog";
import { Placement } from "../shared/grid";
import {
	STRUCTURE_CX,
	STRUCTURE_CZ,
	STRUCTURE_ID,
	STRUCTURE_MACHINE,
	STRUCTURE_ROTATION,
	STRUCTURES_FOLDER,
} from "../shared/protocol";

const workspace = game.GetService("Workspace");

/** Construção vista pelo cliente, lida dos atributos replicados. */
export interface SeenStructure {
	readonly id: number;
	readonly model: Model;
	readonly machine: MachineType;
	readonly placement: Placement;
}

export function numberAttribute(instance: Instance, name: string): number | undefined {
	const value = instance.GetAttribute(name);
	return typeIs(value, "number") ? value : undefined;
}

export function structuresFolder(): Instance {
	return workspace.WaitForChild(STRUCTURES_FOLDER);
}

export function readStructure(model: Instance | undefined): SeenStructure | undefined {
	if (!model?.IsA("Model")) return undefined;
	const machine = findMachine(model.GetAttribute(STRUCTURE_MACHINE));
	const id = numberAttribute(model, STRUCTURE_ID);
	const cx = numberAttribute(model, STRUCTURE_CX);
	const cz = numberAttribute(model, STRUCTURE_CZ);
	const rotation = numberAttribute(model, STRUCTURE_ROTATION);
	if (!machine || id === undefined || cx === undefined || cz === undefined || rotation === undefined) return undefined;
	return { id, model, machine, placement: { cx, cz, rotation } };
}

export function seenStructures(): Array<SeenStructure> {
	const seen = new Array<SeenStructure>();
	for (const child of structuresFolder().GetChildren()) {
		const structure = readStructure(child);
		if (structure) seen.push(structure);
	}
	return seen;
}

function screenRay(screen: Vector2): Ray | undefined {
	return workspace.CurrentCamera?.ViewportPointToRay(screen.X, screen.Y);
}

/** Ponto do piso sob a tela. O piso da área construível fica em Y = 0. */
export function floorPoint(screen: Vector2): Vector3 | undefined {
	const ray = screenRay(screen);
	if (!ray || ray.Direction.Y >= -0.01) return undefined;
	return ray.Origin.add(ray.Direction.mul(-ray.Origin.Y / ray.Direction.Y));
}

export function structureAt(screen: Vector2): SeenStructure | undefined {
	const ray = screenRay(screen);
	if (!ray) return undefined;
	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Include;
	params.FilterDescendantsInstances = [structuresFolder()];
	const hit = workspace.Raycast(ray.Origin, ray.Direction.mul(300), params);
	return readStructure(hit?.Instance.FindFirstAncestorOfClass("Model"));
}
