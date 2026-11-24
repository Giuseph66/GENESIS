import { Counts, INVENTORY_CAPACITY, ItemId, ITEMS } from "../../shared/catalog";

/** Versão do documento. O conteúdo de `world` tem versão própria. */
export const DOCUMENT_VERSION = 1;
/** Recibos guardados por mundo. Cobre a janela de reconciliação, com folga. */
export const RECEIPT_LIMIT = 64;
const MAX_AMOUNT = 1000000;
const MAX_FACTS = 256;
const MAX_ID_LENGTH = 100;

export interface SessionLock {
	readonly token: string;
	/** Segundos Unix. */
	readonly expiresAt: number;
}

export interface MemberData {
	readonly inventory: Counts;
	/** Saque que não coube no inventário. Fica acessível na base. */
	readonly recovery: Counts;
	/** Mantido por compatibilidade do documento. ECHO está sempre ativo. */
	readonly echoOnline: boolean;
	readonly suppliesReady: boolean;
	readonly facts: ReadonlyArray<string>;
}

export interface Members {
	readonly [userId: string]: MemberData;
}

export interface Receipt {
	readonly id: string;
	readonly userId: string;
	readonly items: Counts;
	readonly facts: ReadonlyArray<string>;
	readonly at: number;
}

export interface WorldDocument {
	readonly schemaVersion: number;
	readonly worldId: string;
	readonly ownerId: string;
	readonly revision: number;
	readonly updatedAt: number;
	readonly session?: SessionLock;
	/** Fábrica, construções e pesquisa. Ausente enquanto o mundo não foi gravado. */
	readonly world?: unknown;
	readonly members: Members;
	/** Do mais antigo ao mais novo. */
	readonly receipts: ReadonlyArray<Receipt>;
}

export type LoadFailure = "newer_version" | "invalid" | "migration_failed";

export type LoadResult =
	| { readonly kind: "ok"; readonly document: WorldDocument }
	| { readonly kind: "absent" }
	| { readonly kind: "unavailable"; readonly reason: LoadFailure };

/** Leva um documento da versão da chave para a seguinte. Precisa ser pura. */
export type Migration = (document: { readonly [key: string]: unknown }) => { readonly [key: string]: unknown } | undefined;
export type Migrations = ReadonlyMap<number, Migration>;

/** Sem versões anteriores até aqui. Acrescente N → N+1 ao mudar DOCUMENT_VERSION. */
export const MIGRATIONS: Migrations = new Map<number, Migration>();

export interface LoadRules {
	readonly worldId: string;
	readonly validateWorld: (world: unknown) => boolean;
	readonly migrations?: Migrations;
	readonly version?: number;
}

type Raw = { readonly [key: string]: unknown };

function isInteger(value: unknown, min: number, max: number): value is number {
	return typeIs(value, "number") && value === value && math.floor(value) === value && value >= min && value <= max;
}

function isTime(value: unknown): value is number {
	return typeIs(value, "number") && value === value && value >= 0 && value < math.huge;
}

function isId(value: unknown): value is string {
	return typeIs(value, "string") && value !== "" && value.size() <= MAX_ID_LENGTH;
}

/** Recusa dicionário no lugar de lista, que o tamanho sozinho não acusaria em Luau. */
function listOf(value: unknown, limit: number): ReadonlyArray<unknown> | undefined {
	if (!typeIs(value, "table")) return undefined;
	const list = value as ReadonlyArray<unknown>;
	let entries = 0;
	for (const [key] of pairs(value as object)) {
		if (key === undefined) return undefined;
		entries += 1;
	}
	return entries === list.size() && entries <= limit ? list : undefined;
}

function parseCounts(value: unknown): Counts | undefined {
	if (!typeIs(value, "table")) return undefined;
	const counts: Counts = {};
	for (const [id, amount] of pairs(value as Raw)) {
		// Item removido do catálogo exige migração, e não descarte silencioso.
		if (!ITEMS.some((item) => item.id === id) || !isInteger(amount, 0, MAX_AMOUNT)) return undefined;
		counts[id as ItemId] = amount;
	}
	return counts;
}

function parseFacts(value: unknown): Array<string> | undefined {
	const list = listOf(value, MAX_FACTS);
	if (!list) return undefined;
	const facts = new Array<string>();
	for (const fact of list) {
		if (!isId(fact) || facts.includes(fact)) return undefined;
		facts.push(fact);
	}
	return facts;
}

function parseMember(value: unknown): MemberData | undefined {
	if (!typeIs(value, "table")) return undefined;
	const raw = value as Raw;
	const inventory = parseCounts(raw.inventory);
	const recovery = parseCounts(raw.recovery);
	const facts = parseFacts(raw.facts);
	if (!inventory || !recovery || !facts) return undefined;
	if (!typeIs(raw.echoOnline, "boolean") || !typeIs(raw.suppliesReady, "boolean")) return undefined;
	if (ITEMS.some((item) => (inventory[item.id] ?? 0) > INVENTORY_CAPACITY)) return undefined;
	return { inventory, recovery, echoOnline: raw.echoOnline, suppliesReady: raw.suppliesReady, facts };
}

function parseMembers(value: unknown): Members | undefined {
	if (!typeIs(value, "table")) return undefined;
	const members: { [userId: string]: MemberData } = {};
	for (const [userId, data] of pairs(value as Raw)) {
		const member = parseMember(data);
		if (!isId(userId) || !member) return undefined;
		members[userId] = member;
	}
	return members;
}

function parseReceipts(value: unknown): Array<Receipt> | undefined {
	const list = listOf(value, RECEIPT_LIMIT);
	if (!list) return undefined;
	const receipts = new Array<Receipt>();
	for (const entry of list) {
		if (!typeIs(entry, "table")) return undefined;
		const raw = entry as Raw;
		const { id, userId, at } = raw;
		const items = parseCounts(raw.items);
		const facts = parseFacts(raw.facts);
		if (!isId(id) || !isId(userId) || !isTime(at) || !items || !facts) return undefined;
		if (receipts.some((receipt) => receipt.id === id)) return undefined;
		receipts.push({ id, userId, items, facts, at });
	}
	return receipts;
}

function parseSession(value: unknown): SessionLock | undefined {
	if (!typeIs(value, "table")) return undefined;
	const { token, expiresAt } = value as Raw;
	return isId(token) && isTime(expiresAt) ? { token, expiresAt } : undefined;
}

function parseDocument(raw: Raw, rules: LoadRules, version: number): WorldDocument | undefined {
	const { worldId, ownerId, revision, updatedAt, world } = raw;
	const members = parseMembers(raw.members);
	const receipts = parseReceipts(raw.receipts);
	const session = parseSession(raw.session);
	if (raw.schemaVersion !== version || worldId !== rules.worldId || !isId(ownerId)) return undefined;
	if (!isInteger(revision, 0, 2 ** 52) || !isTime(updatedAt) || !members || !receipts) return undefined;
	if (raw.session !== undefined && !session) return undefined;
	if (world !== undefined && !rules.validateWorld(world)) return undefined;
	return { schemaVersion: version, worldId: rules.worldId, ownerId, revision, updatedAt, session, world, members, receipts };
}

/** Migra e valida. Não altera o valor recebido e pode ser repetida. */
export function loadDocument(value: unknown, rules: LoadRules): LoadResult {
	const target = rules.version ?? DOCUMENT_VERSION;
	const migrations = rules.migrations ?? MIGRATIONS;
	if (value === undefined) return { kind: "absent" };
	if (!typeIs(value, "table")) return { kind: "unavailable", reason: "invalid" };

	let raw = value as Raw;
	const found = raw.schemaVersion;
	if (!isInteger(found, 1, MAX_AMOUNT)) return { kind: "unavailable", reason: "invalid" };
	if (found > target) return { kind: "unavailable", reason: "newer_version" };
	for (let version = found; version < target; version++) {
		const migrated = migrations.get(version)?.(raw);
		if (!migrated || migrated.schemaVersion !== version + 1) return { kind: "unavailable", reason: "migration_failed" };
		raw = migrated;
	}
	const document = parseDocument(raw, rules, target);
	return document ? { kind: "ok", document } : { kind: "unavailable", reason: "invalid" };
}

export function newDocument(worldId: string, ownerId: string, now: number): WorldDocument {
	return { schemaVersion: DOCUMENT_VERSION, worldId, ownerId, revision: 0, updatedAt: now, members: {}, receipts: [] };
}

export function newMember(): MemberData {
	return { inventory: {}, recovery: {}, echoOnline: false, suppliesReady: false, facts: [] };
}

/** Credita o saque: o que cabe vai ao inventário e o excedente, à mochila de recuperação. */
export function creditMember(member: MemberData, items: Counts, facts: ReadonlyArray<string>): MemberData {
	const inventory: Counts = {};
	const recovery: Counts = {};
	for (const item of ITEMS) {
		const held = member.inventory[item.id] ?? 0;
		const gained = items[item.id] ?? 0;
		const fits = math.max(0, math.min(gained, INVENTORY_CAPACITY - held));
		const spare = (member.recovery[item.id] ?? 0) + gained - fits;
		if (held + fits > 0) inventory[item.id] = held + fits;
		if (spare > 0) recovery[item.id] = spare;
	}
	const known = [...member.facts];
	for (const fact of facts) {
		if (!known.includes(fact)) known.push(fact);
	}
	return {
		inventory,
		recovery,
		echoOnline: member.echoOnline,
		suppliesReady: member.suppliesReady,
		facts: known,
	};
}

/** Saque e fatos precisam caber nas mesmas regras da leitura. */
export function isValidGain(items: Counts, facts: ReadonlyArray<string>): boolean {
	return parseCounts(items) !== undefined && parseFacts(facts) !== undefined;
}

export function withReceipt(receipts: ReadonlyArray<Receipt>, receipt: Receipt): ReadonlyArray<Receipt> {
	const kept = new Array<Receipt>();
	const first = math.max(0, receipts.size() + 1 - RECEIPT_LIMIT);
	receipts.forEach((existing, index) => {
		if (index >= first) kept.push(existing);
	});
	kept.push(receipt);
	return kept;
}
