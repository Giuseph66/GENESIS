import type { MachineType } from "./catalog";

/** Nome da direção da frente, para cada rotação. */
export const DIRECTION_NAMES: ReadonlyArray<string> = ["norte", "leste", "sul", "oeste"];

export function hasOutput(machine: MachineType): boolean {
	return machine.recipe !== undefined || machine.id === "belt";
}

/** Recebe itens por trás. O armazém recebe por qualquer lado. */
export function hasInput(machine: MachineType): boolean {
	if (machine.id === "belt" || machine.id === "storage") return true;
	return machine.recipe !== undefined && machine.id !== "miner";
}

/** Esteira aceita por trás e pelos lados. Máquina com receita, só por trás. */
export function acceptsFrom(target: MachineType, sourceRotation: number, targetRotation: number): boolean {
	if (!hasInput(target)) return false;
	if (target.id === "storage") return true;
	if (target.id === "belt") return (sourceRotation + 2) % 4 !== targetRotation;
	return sourceRotation === targetRotation;
}
