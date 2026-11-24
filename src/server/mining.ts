import type { ItemId } from "../shared/catalog";
import type { Reason } from "../shared/protocol";
import type { Inventory } from "./inventory";

/** Um pouco abaixo do intervalo da animação, para tolerar variação de rede. */
const SWING_COOLDOWN = 0.4;

export interface NodeType {
	readonly item: ItemId;
	readonly amount: number;
	/** Golpes até esgotar. Zero nunca esgota. */
	readonly hits: number;
	readonly respawnSeconds: number;
}

export interface HitResult {
	readonly reason: Reason;
	readonly depleted: boolean;
}

/** Jazidas do mundo. O esgotamento é lembrado mesmo com o bloco descarregado. */
export class Mining {
	private readonly types = new Map<string, NodeType>();
	private readonly used = new Map<string, number>();
	private readonly respawnAt = new Map<string, number>();
	private readonly nextSwing = new Map<number, number>();

	public define(id: string, kind: NodeType) {
		this.types.set(id, kind);
	}

	/** Esquece a definição quando o bloco sai do mundo. O esgotamento permanece. */
	public undefine(id: string) {
		this.types.delete(id);
	}

	public isDepleted(id: string, now: number): boolean {
		const at = this.respawnAt.get(id);
		if (at === undefined) return false;
		if (now < at) return true;
		this.respawnAt.delete(id);
		this.used.delete(id);
		return false;
	}

	public hit(id: string, userId: number, inventory: Inventory, now: number): HitResult {
		const kind = this.types.get(id);
		if (!kind) return { reason: "NOT_FOUND", depleted: false };
		if (now < (this.nextSwing.get(userId) ?? 0)) return { reason: "TOO_SOON", depleted: false };
		if (this.isDepleted(id, now)) return { reason: "DEPLETED", depleted: true };
		const amount = math.min(kind.amount, inventory.space(kind.item));
		if (!inventory.add(kind.item, amount)) return { reason: "INVENTORY_FULL", depleted: false };

		this.nextSwing.set(userId, now + SWING_COOLDOWN);
		if (kind.hits === 0) return { reason: "OK", depleted: false };
		const used = (this.used.get(id) ?? 0) + 1;
		this.used.set(id, used);
		if (used < kind.hits) return { reason: "OK", depleted: false };
		this.respawnAt.set(id, now + kind.respawnSeconds);
		return { reason: "OK", depleted: true };
	}
}
