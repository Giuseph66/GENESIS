import { RESOURCES } from "../shared/catalog";
import type { CommandResult, PlayerState } from "../shared/protocol";
import { Inventory } from "./inventory";

/** Progresso do jogador neste servidor. Sobrevive à saída e ao retorno do jogador. */
export class Session {
	public readonly inventory = new Inventory();
	public echoOnline = false;
	public suppliesReady = false;
	/** Resultados recentes, para que repetir um requestId não repita a mutação. */
	public readonly results = new Map<number, { signature: string; result: CommandResult }>();
	public readonly resultOrder = new Array<number>();
	public tokens = 10;
	public tokensAt = os.clock();
	private revision = 0;

	/** O objetivo é um fato registrado: gastar recursos depois não o desfaz. */
	public recordSupplies() {
		if (RESOURCES.every((resource) => this.inventory.get(resource.id) >= resource.goal)) this.suppliesReady = true;
	}

	public state(structures: number): PlayerState {
		this.revision += 1;
		return {
			revision: this.revision,
			echoOnline: this.echoOnline,
			suppliesReady: this.suppliesReady,
			structures,
			inventory: { iron_ore: this.inventory.get("iron_ore"), coal: this.inventory.get("coal") },
		};
	}
}

const sessions = new Map<number, Session>();

export function getSession(player: Player): Session {
	let session = sessions.get(player.UserId);
	if (!session) {
		session = new Session();
		sessions.set(player.UserId, session);
	}
	return session;
}
