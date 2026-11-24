import type { Counts } from "../../shared/catalog";
import {
	creditMember,
	isValidGain,
	LoadFailure,
	loadDocument,
	LoadRules,
	Members,
	Migrations,
	newDocument,
	newMember,
	Receipt,
	WorldDocument,
	withReceipt,
} from "./document";
import { backoffSeconds, RETRY } from "./retry";
import type { WorldStore } from "./store";

/** Validade da exclusividade de escrita. Toda gravação confirmada renova. */
export const LEASE_SECONDS = 180;
/** Folga contra diferença de relógio entre servidores antes de assumir uma sessão vencida. */
export const TAKEOVER_GRACE_SECONDS = 30;
export const CHECKPOINT_SECONDS = 60;
/** Suspende um pouco antes do vencimento, pois a confirmação leva tempo. */
const SUSPEND_MARGIN_SECONDS = 10;
const CLOSE_BUDGET_SECONDS = 20;
const WAIT_SECONDS = 0.1;

export interface OpenOptions {
	readonly store: WorldStore;
	readonly worldId: string;
	readonly ownerId: string;
	/** Segundos Unix, comparáveis entre servidores. */
	readonly clock: () => number;
	readonly sleep: (seconds: number) => void;
	/** Valor em [0, 1). */
	readonly random: () => number;
	readonly newToken: () => string;
	/** Confere o conteúdo de `world` ao carregar. Não pode lançar erro nem esperar. */
	readonly validateWorld?: (world: unknown) => boolean;
	readonly migrations?: Migrations;
}

/** Estado do mundo em um instante, já serializável. Chamado sem espera, no início de cada gravação. */
export interface Capture {
	readonly world: unknown;
	readonly members: Members;
}

export interface Binding {
	readonly capture: () => Capture;
	/** Aplica na memória o saque confirmado. Chamado uma vez por extração, sem espera. */
	readonly credit: (userId: string, items: Counts, facts: ReadonlyArray<string>) => void;
}

export type OpenResult =
	| { readonly kind: "ok"; readonly world: WorldSession; readonly isNew: boolean }
	| { readonly kind: "busy"; readonly expiresAt: number }
	| { readonly kind: "unavailable"; readonly reason: LoadFailure | "store_error"; readonly problem?: string };

export type SessionStatus =
	| "active"
	/** A renovação não foi confirmada a tempo. Recupera se uma gravação for aceita. */
	| "suspended"
	/** Outra sessão assumiu ou o registro deixou de ser legível. Não recupera. */
	| "lost"
	| "closed";

export type SaveResult = "saved" | "clean" | "busy" | "blocked" | "failed" | "lost";
export type ExtractionResult =
	/** Creditada agora. */
	| "confirmed"
	/** Já creditada antes. */
	| "already"
	/** Resultado incerto. Repita com o mesmo ID. */
	| "pending"
	/** Há outra extração incerta a resolver antes. */
	| "busy"
	| "invalid"
	| "lost";

interface PendingExtraction {
	readonly id: string;
	readonly userId: string;
	readonly items: Counts;
	readonly facts: ReadonlyArray<string>;
}

type Attempt = "written" | "present" | "lost" | "error";

function memoryKey(worldId: string): string {
	return `world:${worldId}`;
}

/** Sessão de escrita de um mundo. As gravações são serializadas e conferem o token. */
export class WorldSession {
	private status: SessionStatus = "active";
	private binding?: Binding;
	private writing = false;
	/** Revisão em memória e a última confirmada no armazenamento. */
	private changed = 0;
	private saved = 0;
	private lastWriteAt: number;
	private leaseUntil: number;
	private pending?: PendingExtraction;
	private readonly credited = new Set<string>();

	constructor(
		private readonly options: OpenOptions,
		private readonly rules: LoadRules,
		private readonly token: string,
		private current: WorldDocument,
	) {
		this.lastWriteAt = options.clock();
		this.leaseUntil = current.session?.expiresAt ?? 0;
		for (const receipt of current.receipts) this.credited.add(receipt.id);
	}

	/** Último documento confirmado. */
	public document(): WorldDocument {
		return this.current;
	}

	/** Ligue antes da primeira gravação. */
	public attach(binding: Binding) {
		this.binding = binding;
	}

	public markDirty() {
		this.changed += 1;
	}

	public isDirty(): boolean {
		return this.changed !== this.saved;
	}

	/** Enquanto não for "active", o servidor não deve aceitar mutações do mundo. */
	public state(): SessionStatus {
		const limit = this.leaseUntil - SUSPEND_MARGIN_SECONDS;
		if (this.status === "active" && this.options.clock() >= limit) this.status = "suspended";
		return this.status;
	}

	/** Chame com frequência: grava ou renova quando chegar a hora. Pode esperar. */
	public update(): SaveResult {
		const state = this.state();
		if (state === "lost" || state === "closed") return "lost";
		if (this.writing) return "busy";
		const now = this.options.clock();
		if (state !== "suspended" && now < this.lastWriteAt + CHECKPOINT_SECONDS) return "clean";
		if (this.pending) return this.resolvePending();
		// Mesmo sem mudanças, a gravação renova a exclusividade.
		return this.isDirty() || state === "suspended" || now >= this.leaseUntil - LEASE_SECONDS / 2
			? this.write(math.huge, false)
			: "clean";
	}

	/** Grava agora se houver mudança. Pode esperar. */
	public checkpoint(): SaveResult {
		const state = this.state();
		if (state === "lost" || state === "closed") return "lost";
		if (this.writing) return "busy";
		if (this.pending) return this.resolvePending();
		return this.isDirty() ? this.write(math.huge, false) : "clean";
	}

	/** Crédito durável: itens, fatos e recibo entram na mesma gravação. Pode esperar. */
	public confirmExtraction(id: string, userId: string, items: Counts, facts: ReadonlyArray<string>): ExtractionResult {
		if (id === "" || userId === "" || !isValidGain(items, facts)) return "invalid";
		while (this.writing) this.options.sleep(WAIT_SECONDS);
		const state = this.state();
		if (state === "lost" || state === "closed") return "lost";
		if (this.credited.has(id)) return "already";
		if (this.pending && this.pending.id !== id) return "busy";
		// Uma repetição usa os dados da primeira tentativa, que podem já estar gravados.
		const extraction = this.pending ?? { id, userId, items, facts };
		this.pending = extraction;
		return this.runExtraction(extraction, math.huge);
	}

	/** Última tentativa, dentro do orçamento, e liberação da exclusividade. */
	public close(budgetSeconds = CLOSE_BUDGET_SECONDS): "saved" | "failed" | "lost" {
		const deadline = this.options.clock() + budgetSeconds;
		while (this.writing && this.options.clock() < deadline) this.options.sleep(WAIT_SECONDS);
		const state = this.state();
		if (state === "lost" || state === "closed") return "lost";
		if (this.writing) return "failed";
		if (this.pending && this.runExtraction(this.pending, deadline) === "pending") return "failed";
		const result = this.write(deadline, true);
		if (result === "saved") this.status = "closed";
		return result === "saved" ? "saved" : result === "lost" ? "lost" : "failed";
	}

	private resolvePending(): SaveResult {
		const extraction = this.pending;
		if (!extraction) return "clean";
		const result = this.runExtraction(extraction, math.huge);
		if (result === "lost") return "lost";
		return result === "pending" ? "blocked" : "saved";
	}

	private write(deadline: number, release: boolean): SaveResult {
		this.writing = true;
		let result: SaveResult = "failed";
		for (let failures = 1; failures <= RETRY.attempts; failures++) {
			const revision = this.changed;
			const attempt = this.attempt(undefined, release);
			if (attempt === "lost") {
				result = "lost";
				break;
			}
			if (attempt !== "error") {
				// Se o mundo mudou durante a gravação, a revisão nova continua pendente.
				this.saved = revision;
				result = "saved";
				break;
			}
			if (!this.waitRetry(failures, deadline)) break;
		}
		this.writing = false;
		return result;
	}

	private runExtraction(extraction: PendingExtraction, deadline: number): ExtractionResult {
		this.writing = true;
		let result: ExtractionResult = "pending";
		for (let failures = 1; failures <= RETRY.attempts; failures++) {
			const attempt = this.attempt(extraction, false);
			if (attempt === "lost") {
				this.pending = undefined;
				result = "lost";
				break;
			}
			if (attempt !== "error") {
				this.pending = undefined;
				this.credited.add(extraction.id);
				// A memória recebe o saque antes de liberar a próxima gravação.
				this.binding?.credit(extraction.userId, extraction.items, extraction.facts);
				this.changed += 1;
				result = "confirmed";
				break;
			}
			if (!this.waitRetry(failures, deadline)) break;
		}
		this.writing = false;
		return result;
	}

	private waitRetry(failures: number, deadline: number): boolean {
		if (failures >= RETRY.attempts) return false;
		const wait = backoffSeconds(failures, this.options.random);
		if (this.options.clock() + wait >= deadline) return false;
		this.options.sleep(wait);
		return true;
	}

	private attempt(extraction: PendingExtraction | undefined, release: boolean): Attempt {
		const now = this.options.clock();
		const captured = this.binding?.capture();
		const expiresAt = now + LEASE_SECONDS;
		// Reescritos a cada execução: só vale a última, que é a confirmada.
		let verdict: Attempt = "error";
		let written: WorldDocument | undefined;

		const reply = this.options.store.update(memoryKey(this.options.worldId), (value) => {
			verdict = "error";
			written = undefined;
			const loaded = loadDocument(value, this.rules);
			// Um registro que sumiu, ficou ilegível ou trocou de dono nunca é recriado por cima.
			if (loaded.kind !== "ok" || loaded.document.session?.token !== this.token) {
				verdict = "lost";
				return undefined;
			}
			const stored = loaded.document;
			if (extraction && stored.receipts.some((receipt) => receipt.id === extraction.id)) {
				verdict = "present";
				written = stored;
				return undefined;
			}
			verdict = "written";
			written = this.compose(stored, captured, extraction, release ? undefined : expiresAt, now);
			return written;
		});

		// Atribuições no callback não são vistas pela análise de fluxo do TypeScript.
		const outcome = verdict as Attempt;
		// Sem resposta confirmada, nem a perda da sessão é conclusiva: a repetição decide.
		if (!reply.ok) return "error";
		if (outcome === "lost") {
			this.status = "lost";
			return "lost";
		}
		const document = written as WorldDocument | undefined;
		if (!document) return "error";
		this.current = document;
		if (outcome === "written") {
			this.lastWriteAt = now;
			this.leaseUntil = expiresAt;
			if (this.status === "suspended") this.status = "active";
		}
		return outcome;
	}

	private compose(
		stored: WorldDocument,
		captured: Capture | undefined,
		extraction: PendingExtraction | undefined,
		expiresAt: number | undefined,
		now: number,
	): WorldDocument {
		let members = captured ? captured.members : stored.members;
		let receipts = stored.receipts;
		if (extraction) {
			const changed: { [userId: string]: Members[string] } = {};
			for (const [userId, member] of pairs(members)) changed[userId as string] = member;
			const member = changed[extraction.userId] ?? newMember();
			changed[extraction.userId] = creditMember(member, extraction.items, extraction.facts);
			members = changed;
			const receipt: Receipt = {
				id: extraction.id,
				userId: extraction.userId,
				items: extraction.items,
				facts: extraction.facts,
				at: now,
			};
			receipts = withReceipt(receipts, receipt);
		}
		return {
			schemaVersion: stored.schemaVersion,
			worldId: stored.worldId,
			ownerId: stored.ownerId,
			revision: stored.revision + 1,
			updatedAt: now,
			session: expiresAt === undefined ? undefined : { token: this.token, expiresAt },
			world: captured ? captured.world : stored.world,
			members,
			receipts,
		};
	}
}

/** Abre o mundo com exclusividade de escrita. Pode esperar. */
export function openWorld(options: OpenOptions): OpenResult {
	const token = options.newToken();
	const rules: LoadRules = {
		worldId: options.worldId,
		validateWorld: options.validateWorld ?? ((world) => typeIs(world, "table")),
		migrations: options.migrations,
	};

	let problem = "";
	for (let failures = 1; failures <= RETRY.attempts; failures++) {
		const now = options.clock();
		let result: OpenResult | undefined;
		let opened: WorldDocument | undefined;

		const reply = options.store.update(memoryKey(options.worldId), (value) => {
			result = undefined;
			opened = undefined;
			const loaded = loadDocument(value, rules);
			if (loaded.kind === "unavailable") {
				result = { kind: "unavailable", reason: loaded.reason };
				return undefined;
			}
			const base = loaded.kind === "ok" ? loaded.document : newDocument(options.worldId, options.ownerId, now);
			const lock = base.session;
			if (lock && lock.token !== token && now < lock.expiresAt + TAKEOVER_GRACE_SECONDS) {
				result = { kind: "busy", expiresAt: lock.expiresAt };
				return undefined;
			}
			opened = {
				schemaVersion: base.schemaVersion,
				worldId: base.worldId,
				ownerId: base.ownerId,
				revision: base.revision + 1,
				updatedAt: now,
				session: { token, expiresAt: now + LEASE_SECONDS },
				world: base.world,
				members: base.members,
				receipts: base.receipts,
			};
			return opened;
		});

		const refused = result as OpenResult | undefined;
		const document = opened as WorldDocument | undefined;
		if (reply.ok && refused) return refused;
		if (reply.ok && document) {
			return { kind: "ok", world: new WorldSession(options, rules, token, document), isNew: document.world === undefined };
		}
		problem = reply.ok ? "gravação cancelada" : reply.problem;
		if (failures < RETRY.attempts) options.sleep(backoffSeconds(failures, options.random));
	}
	return { kind: "unavailable", reason: "store_error", problem };
}
