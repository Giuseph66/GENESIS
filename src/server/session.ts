import { Counts, GATHER, INVENTORY_CAPACITY, ITEMS } from "../shared/catalog";
import type { Grants, PartyEntry, Role } from "../shared/party";
import type { CommandResult, PlayerState } from "../shared/protocol";
import type { ResearchState } from "../shared/research";
import { Inventory } from "./inventory";
import type { MemberData } from "./persistence/document";

/** Progresso do mundo: soma do que cada membro já confirmou. */
export interface Progress {
	readonly suppliesReady: boolean;
	readonly facts: ReadonlyArray<string>;
}

export interface PartyState {
	readonly role: Role;
	readonly grants: Grants;
	readonly invitedBy?: string;
	readonly entries: ReadonlyArray<PartyEntry>;
}

export interface WorldFacts extends Progress {
	readonly generatorRestored: boolean;
	readonly automationDone: boolean;
	readonly research: ResearchState;
}

/** Progresso do jogador neste mundo. Sobrevive à saída e ao retorno do jogador. */
export class Session {
	public readonly inventory = new Inventory();
	/** Saque que não coube no inventário. */
	private readonly recovery = new Inventory(math.huge);
	public suppliesReady = false;
	public readonly facts = new Set<string>();
	/** Resultados recentes, para que repetir um requestId não repita a mutação. */
	public readonly results = new Map<number, { signature: string; result: CommandResult }>();
	public readonly resultOrder = new Array<number>();
	public tokens = 10;
	public tokensAt = os.clock();
	private revision = 0;

	/** O objetivo é um fato registrado: gastar recursos depois não o desfaz. */
	public recordSupplies() {
		if (GATHER.every((gather) => this.inventory.get(gather.item) >= gather.goal)) this.suppliesReady = true;
	}

	/** Mesma regra do documento: o que cabe vai ao inventário e o excedente espera. */
	public credit(items: Counts, facts: ReadonlyArray<string>) {
		for (const item of ITEMS) {
			const gained = items[item.id] ?? 0;
			const fits = math.min(gained, this.inventory.space(item.id));
			if (fits > 0) this.inventory.add(item.id, fits);
			if (gained > fits) this.recovery.add(item.id, gained - fits);
		}
		for (const fact of facts) this.facts.add(fact);
	}

	/** Passa ao inventário o que já cabe. Verdadeiro se algo mudou. */
	public claimRecovery(): boolean {
		let changed = false;
		for (const item of ITEMS) {
			const amount = math.min(this.recovery.get(item.id), this.inventory.space(item.id));
			if (amount > 0 && this.recovery.transfer(this.inventory, item.id, amount)) changed = true;
		}
		return changed;
	}

	public state(world: WorldFacts, party: PartyState): PlayerState {
		this.revision += 1;
		const inventory = { iron_ore: 0, coal: 0, iron_bar: 0, component: 0, ancient_fragment: 0 };
		for (const item of ITEMS) inventory[item.id] = this.inventory.get(item.id);
		return {
			revision: this.revision,
			suppliesReady: world.suppliesReady,
			generatorRestored: world.generatorRestored,
			automationDone: world.automationDone,
			research: world.research,
			facts: world.facts,
			inventory,
			role: party.role,
			grants: party.grants,
			invitedBy: party.invitedBy,
			party: party.entries,
		};
	}

	public data(): MemberData {
		const inventory: Counts = {};
		const recovery: Counts = {};
		for (const item of ITEMS) {
			const held = this.inventory.get(item.id);
			const waiting = this.recovery.get(item.id);
			if (held > 0) inventory[item.id] = held;
			if (waiting > 0) recovery[item.id] = waiting;
		}
		return { inventory, recovery, echoOnline: true, suppliesReady: this.suppliesReady, facts: sorted(this.facts) };
	}

	public static restore(data: MemberData): Session {
		const session = new Session();
		for (const item of ITEMS) {
			const held = math.min(data.inventory[item.id] ?? 0, INVENTORY_CAPACITY);
			const waiting = data.recovery[item.id] ?? 0;
			if (held > 0) session.inventory.add(item.id, held);
			if (waiting > 0) session.recovery.add(item.id, waiting);
		}
		session.suppliesReady = data.suppliesReady;
		for (const fact of data.facts) session.facts.add(fact);
		return session;
	}
}

function sorted(facts: ReadonlySet<string>): Array<string> {
	const list = new Array<string>();
	for (const fact of facts) list.push(fact);
	list.sort((a, b) => a < b);
	return list;
}

const sessions = new Map<string, Session>();
/** Membros lidos do documento. */
const stored = new Set<string>();

export function sessionOf(userId: string): Session {
	let session = sessions.get(userId);
	if (!session) {
		session = new Session();
		sessions.set(userId, session);
	}
	return session;
}

export function getSession(player: Player): Session {
	return sessionOf(tostring(player.UserId));
}

export function loadSessions(members: { readonly [userId: string]: MemberData }) {
	for (const [userId, data] of pairs(members)) {
		sessions.set(userId as string, Session.restore(data));
		stored.add(userId as string);
	}
}

/** Quem já teve dados gravados continua no documento, mesmo desconectado ou fora do grupo. */
export function captureSessions(isMember: (userId: string) => boolean): { [userId: string]: MemberData } {
	const members: { [userId: string]: MemberData } = {};
	for (const [userId, session] of sessions) {
		if (stored.has(userId) || isMember(userId)) members[userId] = session.data();
	}
	return members;
}

/** Visitantes não contam: só o que entra no documento do mundo. */
export function worldProgress(isMember: (userId: string) => boolean): Progress {
	const facts = new Set<string>();
	let suppliesReady = false;
	for (const [userId, session] of sessions) {
		if (!stored.has(userId) && !isMember(userId)) continue;
		if (session.suppliesReady) suppliesReady = true;
		for (const fact of session.facts) facts.add(fact);
	}
	return { suppliesReady, facts: sorted(facts) };
}

const RATE_PER_SECOND = 10;
const RATE_BURST = 10;

/** Limite de frequência comum a todos os comandos do jogador. */
export function takeToken(session: Session): boolean {
	const now = os.clock();
	session.tokens = math.min(RATE_BURST, session.tokens + (now - session.tokensAt) * RATE_PER_SECOND);
	session.tokensAt = now;
	if (session.tokens < 1) return false;
	session.tokens -= 1;
	return true;
}
