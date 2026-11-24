import { findItem, findMachine, ITEMS, MachineType } from "../shared/catalog";
import type { ResearchState } from "../shared/research";
import { Buildings, BuildingsSnapshot } from "./buildings";
import { Factory, FactorySnapshot, MachineState } from "./factory";
import { Permissions, PermissionsSnapshot } from "./permissions";
import { Research } from "./research";

export const WORLD_VERSION = 4;

export interface WorldSnapshot {
	readonly schemaVersion: number;
	readonly buildings: BuildingsSnapshot;
	readonly factory: FactorySnapshot;
	readonly research: ResearchState;
	readonly permissions: PermissionsSnapshot;
}

/** Versão 3 era solo: ganha uma lista de membros vazia. */
function upgrade(snapshot: WorldSnapshot): WorldSnapshot {
	if (snapshot.schemaVersion !== 3) return snapshot;
	const { buildings, factory, research } = snapshot;
	return { schemaVersion: 4, buildings, factory, research, permissions: { members: [] } };
}

const MAX_HELD = 64;

function isCount(value: unknown): boolean {
	return typeIs(value, "number") && value >= 0 && value <= MAX_HELD && math.floor(value) === value;
}

function checkCounts(value: unknown) {
	assert(typeIs(value, "table"), "Estoque ausente.");
	const counts = value as { [id: string]: unknown };
	let known = 0;
	for (const item of ITEMS) {
		const amount = counts[item.id];
		if (amount === undefined) continue;
		assert(isCount(amount), `Quantidade inválida: ${item.id}.`);
		known += 1;
	}
	let total = 0;
	for (const [,] of pairs(value as object)) total += 1;
	assert(total === known, "Item desconhecido no estoque.");
}

function checkMachine(machine: MachineType, state: MachineState) {
	checkCounts(state.input);
	checkCounts(state.output);
	checkCounts(state.stock);
	assert(typeIs(state.enabled, "boolean") && typeIs(state.restored, "boolean"), "Estado operacional inválido.");
	assert(typeIs(state.batch, "boolean"), "Lote inválido.");
	assert(typeIs(state.progress, "number") && state.progress >= 0 && state.progress <= 60, "Progresso inválido.");
	assert(typeIs(state.burn, "number") && state.burn >= -1 && state.burn <= 120, "Combustível inválido.");
	assert(state.item === undefined || (machine.id === "belt" && findItem(state.item)), "Item em trânsito inválido.");
	assert(!state.batch || machine.recipe, "Lote em máquina sem receita.");
}

/** Monta os três módulos e recusa dados inconsistentes. Lança erro com o motivo. */
export function restoreWorld(saved: WorldSnapshot, ownerId: number) {
	const snapshot = upgrade(saved);
	assert(snapshot.schemaVersion === WORLD_VERSION, "Versão de snapshot não suportada.");
	const buildings = Buildings.restore(snapshot.buildings);
	for (const { id, state } of snapshot.factory.machines) {
		const machine = findMachine(buildings.get(id)?.machine);
		assert(machine, `Estado sem estrutura: ${id}.`);
		checkMachine(machine, state);
	}
	assert(
		snapshot.factory.machines.size() === snapshot.buildings.structures.size(),
		"Quantidade de máquinas diverge das estruturas.",
	);
	return {
		buildings,
		factory: Factory.restore(buildings, snapshot.factory),
		research: Research.restore(snapshot.research),
		permissions: Permissions.restore(ownerId, snapshot.permissions),
	};
}

/** Para o carregamento: nunca lança erro. */
export function isValidWorld(value: unknown): boolean {
	// O dono só importa para recusar um membro com o mesmo ID, o que a abertura confere.
	const [valid] = pcall(() => restoreWorld(value as WorldSnapshot, 0));
	return valid;
}
