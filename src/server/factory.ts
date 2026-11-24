import {
	acceptsItem,
	BUFFER_CAPACITY,
	Counts,
	FUEL_CAPACITY,
	FUEL_ITEM,
	FUEL_SECONDS,
	ItemId,
	ITEMS,
	MachineType,
	requireMachine,
	STORAGE_CAPACITY,
} from "../shared/catalog";
import { frontCells } from "../shared/grid";
import { acceptsFrom, hasOutput } from "../shared/ports";
import type { Status } from "../shared/protocol";
import type { Buildings, Structure } from "./buildings";

export const STEP_SECONDS = 0.2;
/** A esteira avança um segmento a cada 0,4 s. */
const STEPS_PER_TRANSFER = 2;
/** Absorve o erro acumulado ao somar passos de 0,2 s. */
const EPSILON = 1e-6;

/** Estado de uma máquina. Tudo aqui sobrevive a JSON e a reposicionamento. */
export interface MachineState {
	enabled: boolean;
	restored: boolean;
	status: Status;
	input: Counts;
	output: Counts;
	stock: Counts;
	/** Lote com insumos reservados, em andamento ou pronto à espera de vaga. */
	batch: boolean;
	progress: number;
	/** Segundos restantes do combustível já consumido. */
	burn: number;
	/** Item sobre a esteira. */
	item?: ItemId;
}

export interface FactorySnapshot {
	readonly automationDone: boolean;
	readonly machines: ReadonlyArray<{ readonly id: number; readonly state: MachineState }>;
}

export interface Energy {
	supply: number;
	demand: number;
	granted: number;
}

interface Node {
	structure: Structure;
	machine: MachineType;
	state: MachineState;
	/** ID do destino ligado à saída. */
	target?: number;
}

function count(counts: Counts, item: ItemId): number {
	return counts[item] ?? 0;
}

function change(counts: Counts, item: ItemId, amount: number) {
	counts[item] = count(counts, item) + amount;
}

function total(counts: Counts): number {
	return ITEMS.reduce((sum, item) => sum + count(counts, item.id), 0);
}

function firstItem(counts: Counts): ItemId | undefined {
	return ITEMS.find((item) => count(counts, item.id) > 0)?.id;
}

function newState(machine: MachineType): MachineState {
	return {
		enabled: true,
		restored: machine.id !== "generator",
		status: machine.id === "generator" ? "damaged" : "idle",
		input: {},
		output: {},
		stock: {},
		batch: false,
		progress: 0,
		burn: 0,
	};
}

/** Simulação industrial em passos fixos. Não conhece Instances nem rede. */
export class Factory {
	public readonly energy: Energy = { supply: 0, demand: 0, granted: 0 };
	/** Fato: um componente chegou ao armazém pela linha automática. */
	public automationDone = false;

	private readonly states = new Map<number, MachineState>();
	private nodes = new Array<Node>();
	private readonly byId = new Map<number, Node>();
	private stepCount = 0;

	constructor(private readonly buildings: Buildings) {
		this.rebuild();
	}

	/** Chame após construir, mover ou remover. Mantém o estado das máquinas que continuam no grid. */
	public rebuild() {
		this.nodes = [];
		this.byId.clear();
		for (const structure of this.buildings.all()) {
			const machine = requireMachine(structure.machine);
			const state = this.states.get(structure.id) ?? newState(machine);
			this.states.set(structure.id, state);
			const node: Node = { structure, machine, state };
			this.nodes.push(node);
			this.byId.set(structure.id, node);
		}
		for (const node of this.nodes) node.target = this.findTarget(node);
		this.limitBeltSources();
	}

	public state(id: number): MachineState | undefined {
		return this.states.get(id);
	}

	/** Tudo que está sob custódia da máquina, inclusive o lote reservado. */
	public contents(id: number): Counts {
		const result: Counts = {};
		const node = this.byId.get(id);
		if (!node) return result;
		const { state, machine } = node;
		const recipe = machine.recipe;
		for (const item of ITEMS) {
			let amount = count(state.input, item.id) + count(state.output, item.id) + count(state.stock, item.id);
			if (state.item === item.id) amount += 1;
			if (state.batch && recipe) {
				const ready = state.progress >= recipe.seconds - EPSILON;
				amount += count(ready ? recipe.outputs : recipe.inputs, item.id);
			}
			if (amount > 0) result[item.id] = amount;
		}
		return result;
	}

	/** Esquece a máquina. Entregue `contents` ao destino antes. */
	public forget(id: number) {
		this.states.delete(id);
		this.rebuild();
	}

	/** Quantidade do item que a máquina ainda comporta. */
	public room(id: number, item: ItemId): number {
		const node = this.byId.get(id);
		return node ? this.nodeRoom(node, item) : 0;
	}

	/** Inserção manual. Quem chama já conferiu `room`. */
	public insert(id: number, item: ItemId, amount: number) {
		const node = this.byId.get(id);
		assert(node && amount <= this.nodeRoom(node, item), "Inserção acima do espaço da máquina.");
		change(node.machine.id === "storage" ? node.state.stock : node.state.input, item, amount);
	}

	/** Itens que o jogador pode retirar: estoque e saídas prontas. */
	public extractable(id: number): Counts {
		const result: Counts = {};
		const state = this.states.get(id);
		if (!state) return result;
		for (const item of ITEMS) {
			const amount = count(state.stock, item.id) + count(state.output, item.id);
			if (amount > 0) result[item.id] = amount;
		}
		return result;
	}

	public extract(id: number, item: ItemId, amount: number) {
		const state = this.states.get(id);
		assert(state && amount <= count(this.extractable(id), item), "Retirada acima do disponível.");
		const fromStock = math.min(amount, count(state.stock, item));
		change(state.stock, item, -fromStock);
		change(state.output, item, -(amount - fromStock));
	}

	/** Avança um passo fixo de STEP_SECONDS. */
	public step() {
		for (const node of this.nodes) this.startBatch(node);
		this.distributeEnergy();
		this.stepCount += 1;
		if (this.stepCount % STEPS_PER_TRANSFER === 0) this.transferItems();
	}

	public snapshot(): FactorySnapshot {
		return {
			automationDone: this.automationDone,
			machines: this.nodes.map((node) => ({ id: node.structure.id, state: node.state })),
		};
	}

	public static restore(buildings: Buildings, snapshot: FactorySnapshot): Factory {
		const factory = new Factory(buildings);
		for (const record of snapshot.machines) {
			assert(buildings.get(record.id), `Estado sem estrutura: ${record.id}.`);
			factory.states.set(record.id, record.state);
		}
		factory.automationDone = snapshot.automationDone;
		factory.rebuild();
		return factory;
	}

	private findTarget(node: Node): number | undefined {
		if (!hasOutput(node.machine)) return undefined;
		for (const cell of frontCells(node.machine, node.structure)) {
			const other = this.buildings.at(cell);
			if (!other || other.id === node.structure.id) continue;
			if (acceptsFrom(requireMachine(other.machine), node.structure.rotation, other.rotation)) return other.id;
		}
		return undefined;
	}

	/** Uma esteira tem uma entrada: a de trás ou, sem ela, a lateral de menor ID. */
	private limitBeltSources() {
		const chosen = new Map<number, Node>();
		for (const node of this.nodes) {
			const target = node.target === undefined ? undefined : this.byId.get(node.target);
			if (!target || target.machine.id !== "belt") continue;
			const current = chosen.get(target.structure.id);
			const straight = node.structure.rotation === target.structure.rotation;
			const currentStraight = current !== undefined && current.structure.rotation === target.structure.rotation;
			if (!current || (straight && !currentStraight)) chosen.set(target.structure.id, node);
		}
		for (const node of this.nodes) {
			const target = node.target === undefined ? undefined : this.byId.get(node.target);
			if (target && target.machine.id === "belt" && chosen.get(target.structure.id) !== node) node.target = undefined;
		}
	}

	private nodeRoom(node: Node, item: ItemId): number {
		if (node.machine.id === "belt") return node.state.item === undefined ? 1 : 0;
		if (!acceptsItem(node.machine, item)) return 0;
		if (node.machine.id === "storage") return STORAGE_CAPACITY - total(node.state.stock);
		const capacity = node.machine.id === "generator" ? FUEL_CAPACITY : BUFFER_CAPACITY;
		return capacity - count(node.state.input, item);
	}

	private startBatch(node: Node) {
		const { state, machine } = node;
		const recipe = machine.recipe;
		if (!recipe || state.batch || !state.enabled) return;
		if (ITEMS.some((item) => count(state.input, item.id) < count(recipe.inputs, item.id))) return;
		for (const item of ITEMS) {
			const amount = count(recipe.inputs, item.id);
			if (amount > 0) change(state.input, item.id, -amount);
		}
		state.batch = true;
		state.progress = 0;
	}

	private distributeEnergy() {
		let supply = 0;
		for (const { machine, state } of this.nodes) {
			if (machine.supply > 0 && this.runGenerator(state)) supply += machine.supply;
		}

		let demand = 0;
		let granted = 0;
		for (const { machine, state } of this.nodes) {
			const recipe = machine.recipe;
			if (!recipe) continue;
			if (!state.enabled) {
				state.status = "off";
				continue;
			}
			if (!state.batch) {
				state.status = "no_input";
				continue;
			}
			if (state.progress < recipe.seconds - EPSILON) {
				demand += machine.power;
				// O consumo é concedido inteiro ou a máquina espera.
				if (granted + machine.power > supply) {
					state.status = "no_power";
					continue;
				}
				granted += machine.power;
				state.status = "working";
				state.progress += STEP_SECONDS;
			}
			if (state.progress >= recipe.seconds - EPSILON) this.finishBatch(state, recipe.outputs);
		}
		this.energy.supply = supply;
		this.energy.demand = demand;
		this.energy.granted = granted;
	}

	private runGenerator(state: MachineState): boolean {
		if (!state.restored) {
			state.status = "damaged";
			return false;
		}
		if (!state.enabled) {
			state.status = "off";
			return false;
		}
		if (state.burn <= EPSILON) {
			if (count(state.input, FUEL_ITEM) < 1) {
				state.burn = 0;
				state.status = "no_fuel";
				return false;
			}
			change(state.input, FUEL_ITEM, -1);
			state.burn += FUEL_SECONDS;
		}
		state.burn -= STEP_SECONDS;
		state.status = "working";
		return true;
	}

	private finishBatch(state: MachineState, outputs: Counts) {
		if (ITEMS.some((item) => count(state.output, item.id) + count(outputs, item.id) > BUFFER_CAPACITY)) {
			state.status = "output_full";
			return;
		}
		for (const item of ITEMS) {
			const amount = count(outputs, item.id);
			if (amount > 0) change(state.output, item.id, amount);
		}
		state.batch = false;
		state.progress = 0;
	}

	/** Decide todos os movimentos com a visão inicial e só depois os aplica. */
	private transferItems() {
		const moves = new Array<{ from: Node; to: Node; item: ItemId }>();
		const reserved = new Map<string, number>();
		for (const from of this.nodes) {
			const to = from.target === undefined ? undefined : this.byId.get(from.target);
			const item = from.machine.id === "belt" ? from.state.item : firstItem(from.state.output);
			if (!to || item === undefined) continue;
			// O armazém divide a capacidade entre os itens. As demais reservas são por item.
			const key = to.machine.id === "storage" ? `${to.structure.id}` : `${to.structure.id}:${item}`;
			const pending = reserved.get(key) ?? 0;
			if (this.nodeRoom(to, item) - pending < 1) continue;
			reserved.set(key, pending + 1);
			moves.push({ from, to, item });
		}

		for (const { from, item } of moves) {
			if (from.machine.id === "belt") from.state.item = undefined;
			else change(from.state.output, item, -1);
		}
		for (const { to, item } of moves) {
			if (to.machine.id === "belt") {
				to.state.item = item;
			} else if (to.machine.id === "storage") {
				change(to.state.stock, item, 1);
				if (item === "component") this.automationDone = true;
			} else {
				change(to.state.input, item, 1);
			}
		}
	}
}
