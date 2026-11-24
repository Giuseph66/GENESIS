import { ITEMS } from "../shared/catalog";
import type { Reason } from "../shared/protocol";
import { RESEARCH, ResearchId, ResearchState } from "../shared/research";
import type { Inventory } from "./inventory";

/** Pesquisas do mundo. O custo é debitado uma vez, no início. */
export class Research {
	private completed = new Array<ResearchId>();
	private active?: ResearchId;
	private left = 0;

	/** Próxima pesquisa na ordem do catálogo. */
	public nextId(): ResearchId | undefined {
		return RESEARCH.find((research) => !this.completed.includes(research.id))?.id;
	}

	public start(id: ResearchId, automationDone: boolean, facts: ReadonlySet<string>, inventory: Inventory): Reason {
		const research = RESEARCH.find((candidate) => candidate.id === id);
		if (!research) return "INVALID_REQUEST";
		if (this.completed.includes(id)) return "ALREADY_DONE";
		if (this.active !== undefined) return "RESEARCH_BUSY";
		if (research.needsAutomation && !automationDone) return "MISSING_PREREQUISITE";
		if (research.needsFact !== undefined && !facts.has(research.needsFact)) return "MISSING_PREREQUISITE";
		for (const item of ITEMS) {
			if (inventory.get(item.id) < (research.cost[item.id] ?? 0)) return "INSUFFICIENT_ITEMS";
		}
		for (const item of ITEMS) {
			const amount = research.cost[item.id] ?? 0;
			if (amount > 0) inventory.remove(item.id, amount);
		}
		this.active = id;
		this.left = research.seconds;
		return "OK";
	}

	/** Devolve a pesquisa que acabou de ser concluída. */
	public update(seconds: number): ResearchId | undefined {
		const id = this.active;
		if (id === undefined) return undefined;
		this.left -= seconds;
		if (this.left > 0) return undefined;
		this.active = undefined;
		this.left = 0;
		this.completed.push(id);
		return id;
	}

	public isDone(id: ResearchId): boolean {
		return this.completed.includes(id);
	}

	public state(): ResearchState {
		return { completed: [...this.completed], active: this.active, left: this.left };
	}

	public static restore(state: ResearchState): Research {
		const research = new Research();
		const known = (id: ResearchId) => RESEARCH.some((candidate) => candidate.id === id);
		assert(state.completed.every(known), "Pesquisa desconhecida no snapshot.");
		assert(state.active === undefined || known(state.active), "Pesquisa ativa desconhecida no snapshot.");
		research.completed = [...state.completed];
		research.active = state.active;
		research.left = state.left;
		return research;
	}
}
