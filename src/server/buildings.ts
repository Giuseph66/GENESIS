import { findMachine, MachineId, MachineType, requireMachine } from "../shared/catalog";
import { isInsideGrid, isOnVein, isReserved, occupiedCells, Placement } from "../shared/grid";
import type { Reason } from "../shared/protocol";

export interface Structure extends Placement {
	readonly id: number;
	readonly machine: MachineId;
	/** Zero indica estrutura fixa do cenário. */
	readonly ownerId: number;
}

export interface BuildingsSnapshot {
	readonly nextId: number;
	readonly structures: ReadonlyArray<Structure>;
}

/** Grid do mundo: ocupação e estruturas. Não conhece Instances, rede nem inventário. */
export class Buildings {
	private readonly structures = new Map<number, Structure>();
	private readonly occupancy = new Map<string, number>();
	private nextId = 1;

	/** `ignoreId` permite validar o reposicionamento sobre as próprias células. */
	public check(machine: MachineType, placement: Placement, ignoreId?: number): Reason {
		if (!isInsideGrid(machine, placement)) return "OUT_OF_BOUNDS";
		if (isReserved(machine, placement)) return "RESERVED_AREA";
		const blocked = occupiedCells(machine, placement).some((cell) => {
			const occupant = this.occupancy.get(cell);
			return occupant !== undefined && occupant !== ignoreId;
		});
		if (blocked) return "CELL_OCCUPIED";
		return machine.needsVein && !isOnVein(machine, placement) ? "NO_VEIN" : "OK";
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

	/** Muda a posição e mantém o ID. Chame `check` com o próprio ID antes. */
	public move(id: number, placement: Placement): Structure {
		const previous = this.structures.get(id);
		assert(previous, `Estrutura ${id} inexistente.`);
		const machine = requireMachine(previous.machine);
		const reason = this.check(machine, placement, id);
		assert(reason === "OK", `Posição inválida: ${reason}.`);
		this.remove(id);
		const structure: Structure = {
			id,
			machine: previous.machine,
			ownerId: previous.ownerId,
			cx: placement.cx,
			cz: placement.cz,
			rotation: placement.rotation,
		};
		this.insert(machine, structure);
		return structure;
	}

	public get(id: number): Structure | undefined {
		return this.structures.get(id);
	}

	public at(cell: string): Structure | undefined {
		const id = this.occupancy.get(cell);
		return id === undefined ? undefined : this.structures.get(id);
	}

	public remove(id: number): Structure | undefined {
		const structure = this.structures.get(id);
		if (!structure) return undefined;
		for (const cell of occupiedCells(requireMachine(structure.machine), structure)) this.occupancy.delete(cell);
		this.structures.delete(id);
		return structure;
	}

	/** Em ordem de ID, que é a ordem estável da simulação. */
	public all(): Array<Structure> {
		const list = new Array<Structure>();
		for (const [, structure] of this.structures) list.push(structure);
		list.sort((a, b) => a.id < b.id);
		return list;
	}

	public snapshot(): BuildingsSnapshot {
		return { nextId: this.nextId, structures: this.all() };
	}

	/** Recria o grid e recusa dados inconsistentes, sem corrigir em silêncio. */
	public static restore(snapshot: BuildingsSnapshot): Buildings {
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
