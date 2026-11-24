import { Counts, ITEMS } from "../shared/catalog";
import { AttemptPhase, EndReason, findUpgrade, MAX_STACKS, Offer, UpgradeType } from "../shared/expedition";

/** Saque máximo por item, para caber na reserva feita antes da extração. */
export const LOOT_LIMIT = 40;

/** Espera a última janela de dano antes de confirmar a derrota do chefe. */
const SETTLE_SECONDS = 1;

/** Tentativa de um participante. Tem um único resultado terminal. */
export class Attempt {
	public phase: AttemptPhase = "Preparing";
	public endReason?: EndReason;
	public guardianDefeated = false;
	private loot: Counts = {};
	private upgrades = new Array<string>();
	private readonly offers = new Map<number, ReadonlyArray<string>>();
	private bossDownAt?: number;
	/** Motivo de encerramento recebido enquanto a extração aguarda confirmação. */
	private pendingEnd?: EndReason;

	constructor(public readonly id: string) {}

	public activate(): boolean {
		if (this.phase !== "Preparing") return false;
		this.phase = "Active";
		return true;
	}

	/** Devolve o que coube na mochila. */
	public addLoot(counts: Counts): Counts {
		const taken: Counts = {};
		if (this.phase !== "Active") return taken;
		for (const item of ITEMS) {
			const amount = math.min(counts[item.id] ?? 0, LOOT_LIMIT - (this.loot[item.id] ?? 0));
			if (amount <= 0) continue;
			this.loot[item.id] = (this.loot[item.id] ?? 0) + amount;
			taken[item.id] = amount;
		}
		return taken;
	}

	public lootCopy(): Counts {
		return { ...this.loot };
	}

	public upgradeList(): Array<string> {
		return [...this.upgrades];
	}

	/** Abre a oferta da sala uma vez, sem efeitos que já chegaram ao limite. */
	public openOffer(roomId: number, options: ReadonlyArray<string>): boolean {
		if (this.phase !== "Active" || this.offers.has(roomId)) return false;
		const allowed = options.filter((id) => this.canStack(id));
		this.offers.set(roomId, allowed);
		return !allowed.isEmpty();
	}

	public offer(roomId: number): Offer | undefined {
		const options = this.offers.get(roomId);
		return options && !options.isEmpty() && this.phase === "Active" ? { roomId, options } : undefined;
	}

	/** Escolha única por oferta. */
	public choose(roomId: number, id: string): UpgradeType | undefined {
		const offer = this.offer(roomId);
		const upgrade = findUpgrade(id);
		if (!offer || !upgrade || !offer.options.includes(id) || !this.canStack(id)) return undefined;
		this.offers.set(roomId, []);
		this.upgrades.push(id);
		return upgrade;
	}

	public bossDown(now: number) {
		if (this.phase === "Active" && this.bossDownAt === undefined) this.bossDownAt = now;
	}

	/** Verdadeiro uma vez, quando a derrota do chefe é confirmada com o participante ainda ativo. */
	public settleBoss(now: number): boolean {
		if (this.phase !== "Active" || this.guardianDefeated) return false;
		if (this.bossDownAt === undefined || now < this.bossDownAt + SETTLE_SECONDS) return false;
		this.guardianDefeated = true;
		return true;
	}

	public beginExtraction(): boolean {
		if (this.phase !== "Active" || !this.guardianDefeated) return false;
		this.phase = "Confirming";
		return true;
	}

	/** Resolve a confirmação durável. Sem crédito, volta a valer o que aconteceu na espera. */
	public resolveExtraction(credited: boolean): boolean {
		if (this.phase !== "Confirming") return false;
		if (credited) {
			this.phase = "Extracted";
			return true;
		}
		this.phase = "Active";
		if (this.pendingEnd !== undefined) this.finish(this.pendingEnd);
		return false;
	}

	/** Morte, saída ou falha. Durante a confirmação, aguarda o resultado da escrita. */
	public finish(reason: EndReason): boolean {
		if (this.phase === "Confirming") {
			this.pendingEnd = this.pendingEnd ?? reason;
			return false;
		}
		if (this.phase === "Extracted" || this.phase === "Ended") return false;
		this.phase = "Ended";
		this.endReason = reason;
		return true;
	}

	/** Descarta mochila e melhorias. Devolve o que se perdeu, ou nada se foi extraído. */
	public clear(): Counts {
		const lost = this.phase === "Extracted" ? {} : this.loot;
		this.loot = {};
		this.upgrades = [];
		this.offers.clear();
		return lost;
	}

	public isOver(): boolean {
		return this.phase === "Extracted" || this.phase === "Ended";
	}

	private canStack(id: string): boolean {
		const effect = findUpgrade(id)?.effect;
		return effect !== undefined && this.upgrades.filter((owned) => findUpgrade(owned)?.effect === effect).size() < MAX_STACKS;
	}
}
