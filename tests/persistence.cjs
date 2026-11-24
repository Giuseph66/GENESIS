const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./runtime.cjs");

// Luau que só a persistência usa.
globalThis.pairs = (value) => Object.entries(value);
String.prototype.size = function () {
	return this.length;
};

const documents = load("server/persistence/document");
const { createMemoryStore } = load("server/persistence/store");
const { backoffSeconds } = load("server/persistence/retry");
const persistence = load("server/persistence/session");
const { openWorld } = persistence;

const KEY = "world:w";
const member = (changes = {}) => ({ ...documents.newMember(), ...changes });

/** Relógio que só anda com `sleep`, para testar espera sem esperar. */
function setup() {
	const { store, controls } = createMemoryStore({ encode: JSON.stringify, decode: JSON.parse });
	const env = { now: 1000, slept: [], store, controls, onSleep: undefined, tokens: 0 };
	env.open = (changes = {}) =>
		openWorld({
			store,
			worldId: "w",
			ownerId: "7",
			clock: () => env.now,
			sleep: (seconds) => {
				env.slept.push(seconds);
				env.now += seconds;
				env.onSleep?.();
			},
			random: () => 0.5,
			newToken: () => `token-${(env.tokens += 1)}`,
			...changes,
		});
	/** Memória do servidor ligada à sessão. */
	env.server = (session) => {
		const memory = { world: { machines: 1 }, members: { 7: member({ inventory: { coal: 5 } }) }, credits: [] };
		session.attach({
			capture: () => JSON.parse(JSON.stringify({ world: memory.world, members: memory.members })),
			credit: (userId, items, facts) => {
				memory.credits.push(userId);
				memory.members[userId] = documents.creditMember(memory.members[userId] ?? member(), items, facts);
			},
		});
		return memory;
	};
	env.started = () => {
		const opened = env.open();
		assert.equal(opened.kind, "ok");
		return { session: opened.world, memory: env.server(opened.world) };
	};
	return env;
}

test("mundo novo só nasce com ausência confirmada e volta igual", () => {
	const env = setup();
	const { session, memory } = env.started();
	memory.world.machines = 9;
	session.markDirty();
	assert.equal(session.checkpoint(), "saved");
	assert.equal(session.close(), "saved");
	assert.equal(env.controls.peek(KEY).session, undefined);
	const again = env.open();
	assert.equal(again.isNew, false);
	assert.deepEqual(again.world.document().world, { machines: 9 });
	assert.deepEqual(again.world.document().members["7"].inventory, { coal: 5 });
});

test("falha do armazenamento na abertura não cria nem substitui dados", () => {
	const env = setup();
	env.controls.faults.push("error", "error", "error", "error");
	assert.deepEqual(env.open(), { kind: "unavailable", reason: "store_error", problem: "gravação recusada" });
	assert.equal(env.controls.peek(KEY), undefined);
	assert.equal(env.slept.length, 3);
});

test("abertura com resposta perdida reencontra o próprio token", () => {
	const env = setup();
	env.controls.faults.push("lost_response");
	const opened = env.open();
	assert.equal(opened.kind, "ok");
	assert.equal(opened.isNew, true);
});

test("SAVE-02 dados inválidos ou futuros deixam o mundo indisponível e preservado", () => {
	const valid = {
		schemaVersion: 1,
		worldId: "w",
		ownerId: "7",
		revision: 3,
		updatedAt: 10,
		world: {},
		members: { 7: member() },
		receipts: [],
	};
	const receipt = { id: "a", userId: "7", items: {}, facts: [], at: 1 };
	const broken = [
		[{ ...valid, schemaVersion: 2 }, "newer_version"],
		[{ ...valid, schemaVersion: 0 }, "invalid"],
		[{ ...valid, schemaVersion: undefined }, "invalid"],
		["texto", "invalid"],
		[{ ...valid, worldId: "outro" }, "invalid"],
		[{ ...valid, revision: -1 }, "invalid"],
		[{ ...valid, members: undefined }, "invalid"],
		[{ ...valid, members: { 7: member({ inventory: { coal: -1 } }) } }, "invalid"],
		[{ ...valid, members: { 7: member({ inventory: { coal: 1.5 } }) } }, "invalid"],
		[{ ...valid, members: { 7: member({ inventory: { coal: 201 } }) } }, "invalid"],
		[{ ...valid, members: { 7: member({ inventory: { desconhecido: 1 } }) } }, "invalid"],
		[{ ...valid, members: { 7: { ...member(), facts: undefined } } }, "invalid"],
		[{ ...valid, receipts: [receipt, receipt] }, "invalid"],
		[{ ...valid, session: { token: "x" } }, "invalid"],
		[{ ...valid, world: "quebrado" }, "invalid"],
	];
	for (const [value, reason] of broken) {
		const env = setup();
		env.controls.poke(KEY, value);
		const before = JSON.stringify(env.controls.peek(KEY));
		assert.deepEqual(env.open(), { kind: "unavailable", reason }, before);
		assert.equal(JSON.stringify(env.controls.peek(KEY)), before);
		assert.equal(env.controls.writes, 0);
	}
	const env = setup();
	env.controls.poke(KEY, valid);
	assert.equal(env.open().kind, "ok");
});

test("SAVE-02 migração percorre cada versão e falha sem gravar", () => {
	const rules = { worldId: "w", validateWorld: () => true, version: 3 };
	const old = { schemaVersion: 1, worldId: "w", ownerId: "7", revision: 1, updatedAt: 1, members: {} };
	const migrations = new Map([
		[1, (raw) => ({ ...raw, schemaVersion: 2, receipts: [] })],
		[2, (raw) => ({ ...raw, schemaVersion: 3, world: { migrated: true } })],
	]);
	const loaded = documents.loadDocument(old, { ...rules, migrations });
	assert.equal(loaded.kind, "ok");
	assert.equal(loaded.document.schemaVersion, 3);
	assert.deepEqual(loaded.document.world, { migrated: true });
	assert.deepEqual(old.receipts, undefined);

	for (const bad of [new Map([[1, migrations.get(1)]]), new Map([[1, () => undefined]]), new Map([[1, (raw) => raw]])]) {
		const result = documents.loadDocument(old, { ...rules, migrations: bad });
		assert.deepEqual(result, { kind: "unavailable", reason: "migration_failed" });
	}
});

test("SAVE-04 segunda sessão espera o vencimento e a antiga não grava mais", () => {
	const env = setup();
	const { session, memory } = env.started();
	const { expiresAt } = session.document().session;
	assert.deepEqual(env.open(), { kind: "busy", expiresAt });
	env.now = expiresAt + persistence.TAKEOVER_GRACE_SECONDS - 1;
	assert.equal(env.open().kind, "busy");
	env.now += 1;
	const second = env.open();
	assert.equal(second.kind, "ok");

	const before = JSON.stringify(env.controls.peek(KEY));
	memory.world.machines = 99;
	session.markDirty();
	assert.equal(session.checkpoint(), "lost");
	assert.equal(session.state(), "lost");
	assert.equal(session.confirmExtraction("x", "7", { coal: 1 }, []), "lost");
	assert.equal(session.update(), "lost");
	assert.equal(session.close(), "lost");
	assert.equal(JSON.stringify(env.controls.peek(KEY)), before);
	assert.deepEqual(memory.credits, []);
});

test("SAVE-04 troca de token no meio da gravação cancela a sessão antiga", () => {
	const env = setup();
	const { session } = env.started();
	env.controls.onConflict = () => {
		const stored = env.controls.peek(KEY);
		env.controls.poke(KEY, { ...stored, session: { token: "outro", expiresAt: 9999 } });
	};
	env.controls.faults.push("conflict");
	session.markDirty();
	assert.equal(session.checkpoint(), "lost");
	assert.equal(env.controls.peek(KEY).session.token, "outro");
});

test("registro apagado ou ilegível durante a sessão não é recriado", () => {
	const env = setup();
	const { session } = env.started();
	env.controls.poke(KEY, { schemaVersion: 99 });
	session.markDirty();
	assert.equal(session.checkpoint(), "lost");
	assert.deepEqual(env.controls.peek(KEY), { schemaVersion: 99 });
});

test("renovação sem confirmação suspende e uma gravação aceita recupera", () => {
	const env = setup();
	const { session } = env.started();
	env.now += persistence.LEASE_SECONDS - 5;
	assert.equal(session.state(), "suspended");
	env.controls.faults.push("error", "error", "error", "error");
	assert.equal(session.update(), "failed");
	assert.equal(session.state(), "suspended");
	assert.equal(session.update(), "saved");
	assert.equal(session.state(), "active");
});

test("checkpoint de 60 s grava só o que mudou e renova mesmo sem mudança", () => {
	const env = setup();
	const { session } = env.started();
	session.markDirty();
	env.now += 59;
	assert.equal(session.update(), "clean");
	env.now += 1;
	assert.equal(session.update(), "saved");
	const { writes } = env.controls;
	env.now += 60;
	assert.equal(session.update(), "clean");
	assert.equal(env.controls.writes, writes);
	env.now += 30;
	assert.equal(session.update(), "saved");
	assert.equal(session.document().session.expiresAt, env.now + persistence.LEASE_SECONDS);
});

test("mudança durante a gravação continua pendente", () => {
	const env = setup();
	const { session, memory } = env.started();
	session.markDirty();
	env.controls.faults.push("conflict");
	env.controls.onConflict = () => {
		memory.world.machines = 2;
		session.markDirty();
	};
	assert.equal(session.checkpoint(), "saved");
	assert.equal(env.controls.peek(KEY).world.machines, 1);
	assert.equal(session.isDirty(), true);
	assert.equal(session.checkpoint(), "saved");
	assert.equal(env.controls.peek(KEY).world.machines, 2);
	assert.equal(session.checkpoint(), "clean");
});

test("gravações do mundo são serializadas", () => {
	const env = setup();
	const { session } = env.started();
	const results = [];
	env.controls.faults.push("error");
	env.onSleep = () => {
		env.onSleep = undefined;
		results.push(session.checkpoint(), session.update());
	};
	session.markDirty();
	assert.equal(session.checkpoint(), "saved");
	assert.deepEqual(results, ["busy", "busy"]);
});

test("retentativas são limitadas, com espera crescente e jitter", () => {
	const env = setup();
	const { session } = env.started();
	session.markDirty();
	env.controls.faults.push("error", "error", "error", "error", "error");
	assert.equal(session.checkpoint(), "failed");
	assert.deepEqual(env.slept, [0.375, 0.75, 1.5]);
	assert.equal(session.isDirty(), true);
	assert.equal(backoffSeconds(1, () => 0), 0.25);
	assert.equal(backoffSeconds(20, () => 0.999999) <= 8, true);
});

test("transformação repetida por conflito credita uma vez", () => {
	const env = setup();
	const { session, memory } = env.started();
	env.controls.faults.push("conflict");
	assert.equal(session.confirmExtraction("e1", "7", { component: 2 }, ["fato"]), "confirmed");
	assert.equal(env.controls.peek(KEY).members["7"].inventory.component, 2);
	assert.equal(env.controls.peek(KEY).receipts.length, 1);
	assert.equal(memory.members["7"].inventory.component, 2);
});

test("SAVE-03 resposta perdida encontra o recibo e credita uma vez", () => {
	const env = setup();
	const { session, memory } = env.started();
	env.controls.faults.push("lost_response");
	assert.equal(session.confirmExtraction("e1", "7", { component: 2 }, ["guardião"]), "confirmed");
	assert.equal(session.confirmExtraction("e1", "7", { component: 2 }, ["guardião"]), "already");
	assert.deepEqual(memory.credits, ["7"]);
	assert.equal(session.checkpoint(), "saved");
	const stored = env.controls.peek(KEY);
	assert.deepEqual(stored.members["7"], member({ inventory: { coal: 5, component: 2 }, facts: ["guardião"] }));
	assert.equal(stored.receipts.length, 1);
});

test("SAVE-03 resultado incerto bloqueia o checkpoint até resolver", () => {
	const env = setup();
	const { session, memory } = env.started();
	env.controls.faults.push("lost_response", "error", "error", "error");
	assert.equal(session.confirmExtraction("e1", "7", { component: 2 }, []), "pending");
	assert.deepEqual(memory.credits, []);
	assert.equal(session.confirmExtraction("e2", "7", { coal: 1 }, []), "busy");
	env.controls.faults.push("error", "error", "error", "error");
	session.markDirty();
	assert.equal(session.checkpoint(), "blocked");
	assert.equal(env.controls.peek(KEY).members["7"].inventory.component, 2);
	assert.equal(session.checkpoint(), "saved");
	assert.deepEqual(memory.credits, ["7"]);
	assert.equal(session.checkpoint(), "saved");
	assert.equal(env.controls.peek(KEY).members["7"].inventory.component, 2);
});

test("SAVE-03 servidor que para após gravar retoma com o saque e recusa repetir", () => {
	const env = setup();
	const { session } = env.started();
	env.controls.faults.push("lost_response", "error", "error", "error");
	assert.equal(session.confirmExtraction("e1", "7", { component: 2 }, []), "pending");
	env.now += persistence.LEASE_SECONDS + persistence.TAKEOVER_GRACE_SECONDS;
	const { session: next, memory } = env.started();
	assert.equal(next.document().members["7"].inventory.component, 2);
	assert.equal(next.confirmExtraction("e1", "7", { component: 2 }, []), "already");
	assert.deepEqual(memory.credits, []);
});

test("falha sem gravar não credita", () => {
	const env = setup();
	const { session, memory } = env.started();
	env.controls.faults.push("error", "error", "error", "error");
	assert.equal(session.confirmExtraction("e1", "7", { component: 2 }, []), "pending");
	assert.equal((env.controls.peek(KEY).members["7"]?.inventory ?? {}).component, undefined);
	assert.deepEqual(memory.credits, []);
	assert.equal(session.confirmExtraction("e1", "7", { component: 999 }, []), "confirmed");
	assert.equal(memory.members["7"].inventory.component, 2);
});

test("saque inválido é recusado antes de gravar", () => {
	const env = setup();
	const { session } = env.started();
	const { writes } = env.controls;
	for (const items of [{ coal: -1 }, { coal: 1.5 }, { coal: NaN }, { inexistente: 1 }]) {
		assert.equal(session.confirmExtraction("e1", "7", items, []), "invalid");
	}
	assert.equal(session.confirmExtraction("", "7", {}, []), "invalid");
	assert.equal(env.controls.writes, writes);
});

test("excedente vai para a recuperação sem perder itens", () => {
	const full = member({ inventory: { coal: 195 }, recovery: { coal: 1 }, facts: ["a"] });
	const credited = documents.creditMember(full, { coal: 10, component: 1 }, ["a", "b"]);
	assert.deepEqual(credited.inventory, { coal: 200, component: 1 });
	assert.deepEqual(credited.recovery, { coal: 6 });
	assert.deepEqual(credited.facts, ["a", "b"]);
	assert.deepEqual(full.inventory, { coal: 195 });
});

test("recibos são limitados e mantêm os mais novos", () => {
	let receipts = [];
	for (let i = 0; i < documents.RECEIPT_LIMIT + 5; i++) {
		receipts = documents.withReceipt(receipts, { id: `e${i}`, userId: "7", items: {}, facts: [], at: i });
	}
	assert.equal(receipts.length, documents.RECEIPT_LIMIT);
	assert.equal(receipts[0].id, "e5");
});

test("encerramento grava, libera e respeita o orçamento", () => {
	const env = setup();
	const { session } = env.started();
	session.markDirty();
	assert.equal(session.close(), "saved");
	assert.equal(session.state(), "closed");
	assert.equal(session.checkpoint(), "lost");

	const { session: second } = env.started();
	env.controls.faults.push("error", "error", "error", "error");
	const start = env.now;
	assert.equal(second.close(1), "failed");
	assert.ok(env.now - start <= 1);
	assert.equal(second.state(), "active");
});

test("encerramento resolve a extração incerta antes de liberar", () => {
	const env = setup();
	const { session, memory } = env.started();
	env.controls.faults.push("lost_response", "error", "error", "error");
	session.confirmExtraction("e1", "7", { component: 2 }, []);
	assert.equal(session.close(), "saved");
	assert.deepEqual(memory.credits, ["7"]);
	assert.equal(env.controls.peek(KEY).members["7"].inventory.component, 2);
	assert.equal(env.controls.peek(KEY).session, undefined);
});
