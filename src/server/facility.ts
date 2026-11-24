import { acceptsItem, COST_ITEM, Counts, GENERATOR_RESTORE_COST, ItemId, ITEMS, requireMachine } from "../shared/catalog";
import { EMERGENCY_GENERATOR, placementCenter } from "../shared/grid";
import type { Grant } from "../shared/party";
import type { Action, FacilityAction, Reason } from "../shared/protocol";
import { Buildings, Structure } from "./buildings";
import { Factory, STEP_SECONDS } from "./factory";
import type { Inventory } from "./inventory";
import { Permissions } from "./permissions";
import { Research } from "./research";
import { restoreWorld, WORLD_VERSION, WorldSnapshot } from "./snapshot";

/** Quem age: identidade do servidor, estoque e alcance. */
export interface Actor {
	readonly userId: number;
	readonly inventory: Inventory;
	readonly isNear: (point: Vector3) => boolean;
}

/** Recebe as mudanças de representação. Nos testes é um objeto vazio. */
export interface FacilityView {
	readonly show: (structure: Structure) => void;
	readonly hide: (id: number) => void;
}

/** Evita a espiral de atraso: acima disso a simulação anda mais devagar. */
const MAX_STEPS_PER_UPDATE = 5;

const REQUIRED_GRANT: { readonly [kind in FacilityAction["kind"]]: Grant } = {
	build: "build",
	restore: "build",
	toggle: "build",
	move: "remove",
	remove: "remove",
	insert: "transfer",
	extract: "transfer",
};

/** Instalação do mundo. Cada ação valida tudo antes de mudar grid, máquinas e inventário juntos. */
export class Facility {
	public readonly buildings: Buildings;
	public readonly factory: Factory;
	public readonly research: Research;
	public readonly permissions: Permissions;
	private pending = 0;

	constructor(
		ownerId: number,
		saved: WorldSnapshot | undefined,
		private readonly view: FacilityView,
	) {
		if (saved) {
			const restored = restoreWorld(saved, ownerId);
			this.buildings = restored.buildings;
			this.factory = restored.factory;
			this.research = restored.research;
			this.permissions = restored.permissions;
		} else {
			this.buildings = new Buildings();
			this.buildings.place(requireMachine("generator"), EMERGENCY_GENERATOR, 0);
			this.factory = new Factory(this.buildings);
			this.research = new Research();
			this.permissions = new Permissions(ownerId);
		}
		for (const structure of this.buildings.all()) view.show(structure);
	}

	public generatorRestored(): boolean {
		return this.buildings.all().some((structure) => {
			const state = this.factory.state(structure.id);
			return structure.machine === "generator" && state !== undefined && state.restored;
		});
	}

	/** Devolve quantos passos foram simulados. */
	public update(seconds: number): number {
		this.pending = math.min(this.pending + seconds, STEP_SECONDS * MAX_STEPS_PER_UPDATE);
		let steps = 0;
		while (this.pending >= STEP_SECONDS) {
			this.pending -= STEP_SECONDS;
			this.factory.step();
			steps += 1;
		}
		return steps;
	}

	/** Compartilha referências com a simulação. Copie antes de guardar. */
	public snapshot(): WorldSnapshot {
		return {
			schemaVersion: WORLD_VERSION,
			buildings: this.buildings.snapshot(),
			factory: this.factory.snapshot(),
			research: this.research.state(),
			permissions: this.permissions.snapshot(),
		};
	}

	/** Inicia a próxima pesquisa. Quem chama confere a proximidade do terminal. */
	public startResearch(actor: Pick<Actor, "inventory">, facts: ReadonlySet<string>): Reason {
		const id = this.research.nextId();
		return id === undefined ? "ALREADY_DONE" : this.research.start(id, this.factory.automationDone, facts, actor.inventory);
	}

	/** A permissão vale no momento da aplicação, e não no do envio. */
	public execute(actor: Actor, action: FacilityAction): Reason {
		if (this.permissions.role(actor.userId) === "visitor") return "NOT_MEMBER";
		if (!this.permissions.can(actor.userId, REQUIRED_GRANT[action.kind])) return "NOT_AUTHORIZED";
		if (action.kind === "build") return this.build(actor, action);

		const structure = this.buildings.get(action.structureId);
		if (!structure) return "NOT_FOUND";
		const changesLayout = action.kind === "move" || action.kind === "remove";
		if (changesLayout && structure.ownerId === 0) return "NOT_AUTHORIZED";
		if (!actor.isNear(placementCenter(requireMachine(structure.machine), structure))) return "TOO_FAR";

		if (action.kind === "move") return this.move(actor, structure, action);
		if (action.kind === "remove") return this.remove(actor, structure);
		if (action.kind === "restore") return this.restoreGenerator(actor, structure);
		if (action.kind === "toggle") return this.toggle(structure, action.enabled);
		if (action.kind === "insert") return this.insert(actor, structure, action.item, action.amount);
		return this.extract(actor, structure);
	}

	private build(actor: Actor, action: Extract<Action, { kind: "build" }>): Reason {
		const machine = requireMachine(action.machine);
		if (!machine.buildable) return "NOT_AUTHORIZED";
		const reason = this.buildings.check(machine, action);
		if (reason !== "OK") return reason;
		if (!actor.isNear(placementCenter(machine, action))) return "TOO_FAR";
		if (!actor.inventory.remove(COST_ITEM, machine.cost)) return "INSUFFICIENT_ITEMS";
		const structure = this.buildings.place(machine, action, actor.userId);
		this.factory.rebuild();
		this.view.show(structure);
		return "OK";
	}

	private move(actor: Actor, structure: Structure, action: Extract<Action, { kind: "move" }>): Reason {
		const machine = requireMachine(structure.machine);
		const reason = this.buildings.check(machine, action, structure.id);
		if (reason !== "OK") return reason;
		if (!actor.isNear(placementCenter(machine, action))) return "TOO_FAR";
		const moved = this.buildings.move(structure.id, action);
		this.factory.rebuild();
		this.view.hide(structure.id);
		this.view.show(moved);
		return "OK";
	}

	private remove(actor: Actor, structure: Structure): Reason {
		const refund: Counts = this.factory.contents(structure.id);
		refund[COST_ITEM] = (refund[COST_ITEM] ?? 0) + requireMachine(structure.machine).cost;
		if (!actor.inventory.addAll(refund)) return "INVENTORY_FULL";
		this.buildings.remove(structure.id);
		this.factory.forget(structure.id);
		this.view.hide(structure.id);
		return "OK";
	}

	private restoreGenerator(actor: Actor, structure: Structure): Reason {
		const state = this.factory.state(structure.id);
		if (!state || state.restored) return "INVALID_REQUEST";
		if (!actor.inventory.remove(COST_ITEM, GENERATOR_RESTORE_COST)) return "INSUFFICIENT_ITEMS";
		state.restored = true;
		return "OK";
	}

	private toggle(structure: Structure, enabled: boolean): Reason {
		const state = this.factory.state(structure.id);
		const machine = requireMachine(structure.machine);
		if (!state || (!machine.recipe && machine.supply === 0)) return "INVALID_REQUEST";
		state.enabled = enabled;
		return "OK";
	}

	private insert(actor: Actor, structure: Structure, item: ItemId, wanted: number): Reason {
		if (!acceptsItem(requireMachine(structure.machine), item)) return "INVALID_REQUEST";
		const room = this.factory.room(structure.id, item);
		if (room <= 0) return "MACHINE_FULL";
		const amount = math.min(wanted, room, actor.inventory.get(item));
		if (!actor.inventory.remove(item, amount)) return "INSUFFICIENT_ITEMS";
		this.factory.insert(structure.id, item, amount);
		return "OK";
	}

	private extract(actor: Actor, structure: Structure): Reason {
		const available = this.factory.extractable(structure.id);
		let found = false;
		let taken = false;
		for (const item of ITEMS) {
			const stored = available[item.id] ?? 0;
			if (stored === 0) continue;
			found = true;
			const amount = math.min(stored, actor.inventory.space(item.id));
			if (!actor.inventory.add(item.id, amount)) continue;
			this.factory.extract(structure.id, item.id, amount);
			taken = true;
		}
		if (!found) return "NOTHING_TO_TAKE";
		return taken ? "OK" : "INVENTORY_FULL";
	}
}
