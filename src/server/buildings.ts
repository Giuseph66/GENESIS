import { findMachine, MachineId, MachineType } from "../shared/catalog";
import { isInsideGrid, isReserved, occupiedCells, Placement } from "../shared/grid";
import type { Reason } from "../shared/protocol";

export interface Structure extends Placement {
	readonly id: number;
	readonly machine: MachineId;
	readonly ownerId: number;
}

export interface BuildingsSnapshot {
	readonly schemaVersion: 1;
	readonly nextId: number;
	readonly structures: ReadonlyArray<Structure>;
}

/** Grid do mundo: ocupação e estruturas. Não conhece Instances, rede nem inventário. */
export class Buildings {
	private readonly structures = new Map<number, Structure>();
	private readonly occupancy = new Map<string, number>();
	private nextId = 1;

	public check(machine: MachineType, placement: Placement): Reason {
		if (!isInsideGrid(machine, placement)) return "OUT_OF_BOUNDS";
		if (isReserved(machine, placement)) return "RESERVED_AREA";
		const blocked = occupiedCells(machine, placement).some((cell) => this.occupancy.has(cell));
		return blocked ? "CELL_OCCUPIED" : "OK";
	}

	/** Chame `check` antes. Lança erro se a posição for inválida. */
	public place(machine: MachineType, placement: Placement, ownerId: number): Structure {
		const structure: Structure = {
			id: this.nextId,
			machine: machine.id,
			ownerId,
			cx: placement.cx,
			cz: placement.cz,
			rotation: placement.rotation,
		};
		this.insert(machine, structure);
		this.nextId += 1;
		return structure;
	}

	public get(id: number): Structure | undefined {
		return this.structures.get(id);
	}

	public remove(id: number): Structure | undefined {
		const structure = this.structures.get(id);
		const machine = structure && findMachine(structure.machine);
		if (!structure || !machine) return undefined;

		for (const cell of occupiedCells(machine, structure)) this.occupancy.delete(cell);
		this.structures.delete(id);
		return structure;
	}

	public all(): Array<Structure> {
		const list = new Array<Structure>();
		for (const [, structure] of this.structures) list.push(structure);
		list.sort((a, b) => a.id < b.id);
		return list;
	}

	public snapshot(): BuildingsSnapshot {
		return { schemaVersion: 1, nextId: this.nextId, structures: this.all() };
	}

	/** Recria o grid e recusa dados inconsistentes, sem corrigir em silêncio. */
	public static restore(snapshot: BuildingsSnapshot): Buildings {
		assert(snapshot.schemaVersion === 1, "Versão de snapshot não suportada.");
		const buildings = new Buildings();
		for (const structure of snapshot.structures) {
			const machine = findMachine(structure.machine);
			assert(machine, `Máquina desconhecida no snapshot: ${structure.machine}.`);
			assert(structure.id < snapshot.nextId, "ID de estrutura fora da sequência.");
			buildings.insert(machine, structure);
		}
		buildings.nextId = snapshot.nextId;
		return buildings;
	}

	private insert(machine: MachineType, structure: Structure) {
		const reason = this.check(machine, structure);
		assert(reason === "OK", `Posição inválida: ${reason}.`);
		assert(!this.structures.has(structure.id), `ID repetido: ${structure.id}.`);
		for (const cell of occupiedCells(machine, structure)) this.occupancy.set(cell, structure.id);
		this.structures.set(structure.id, structure);
	}
}
