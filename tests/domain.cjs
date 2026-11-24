const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./runtime.cjs");

const { Inventory } = load("server/inventory");
const { Buildings } = load("server/buildings");
const { Factory } = load("server/factory");
const { Facility } = load("server/facility");
const { Mining } = load("server/mining");
const { isValidWorld } = load("server/snapshot");
const { Session } = load("server/session");
const story = load("shared/story");
const { parseCommand } = load("server/commands");
const catalog = load("shared/catalog");
const grid = load("shared/grid");

const machine = (id) => catalog.requireMachine(id);
const at = (cx, cz, rotation = 0) => ({ cx, cz, rotation });
const view = { show: () => {}, hide: () => {} };

const copy = (value) => JSON.parse(JSON.stringify(value));
const reload = (facility) => new Facility(7, copy(facility.snapshot()), view);
const noFacts = new Set();

function world() {
	const facility = new Facility(7, undefined, view);
	const actor = { userId: 7, inventory: new Inventory(), isNear: () => true };
	const act = (action) => facility.execute(actor, action);
	const run = (seconds) => {
		for (let i = 0; i < Math.round(seconds / 0.2); i++) facility.factory.step();
	};
	const find = (id) => facility.buildings.all().find((structure) => structure.machine === id);
	const state = (id) => facility.factory.state(find(id).id);
	return { facility, actor, act, run, find, state, inventory: actor.inventory };
}

/** Linha de referência do tutorial, com seis esteiras, para +Z. */
const LINE = [
	["miner", 10, 0],
	["belt", 10, 2],
	["belt", 10, 3],
	["furnace", 10, 4],
	["belt", 10, 6],
	["belt", 10, 7],
	["assembler", 10, 8],
	["belt", 10, 10],
	["belt", 10, 11],
	["storage", 10, 12],
];

function poweredLine(line = LINE) {
	const w = world();
	w.inventory.add("iron_ore", 30);
	w.inventory.add("coal", 6);
	const generator = w.find("generator").id;
	assert.equal(w.act({ kind: "restore", structureId: generator }), "OK");
	assert.equal(w.act({ kind: "insert", structureId: generator, item: "coal", amount: 6 }), "OK");
	for (const [id, cx, cz] of line) assert.equal(w.act({ kind: "build", machine: id, ...at(cx, cz, 2) }), "OK", id);
	return w;
}

/** Ferro no mundo: cada barra vale um minério e cada componente, dois. */
function ironIn(facility) {
	let iron = 0;
	for (const structure of facility.buildings.all()) {
		const contents = facility.factory.contents(structure.id);
		iron += (contents.iron_ore ?? 0) + (contents.iron_bar ?? 0) + 2 * (contents.component ?? 0);
	}
	return iron;
}

test("INV-01 transferência acima do saldo ou da capacidade preserva os estoques", () => {
	const a = new Inventory(10);
	const b = new Inventory(5);
	a.add("coal", 8);
	assert.equal(a.transfer(b, "coal", 9), false);
	assert.equal(a.transfer(b, "coal", 6), false);
	assert.deepEqual([a.get("coal"), b.get("coal")], [8, 0]);
	assert.equal(a.transfer(b, "coal", 5), true);
	assert.deepEqual([a.get("coal"), b.get("coal")], [3, 5]);
});

test("INV-02 o último item é transferido uma vez", () => {
	const [a, b, c] = [new Inventory(), new Inventory(), new Inventory()];
	a.add("coal", 1);
	assert.deepEqual([a.transfer(b, "coal", 1), a.transfer(c, "coal", 1)], [true, false]);
});

test("quantidades inválidas são recusadas", () => {
	for (const amount of [0, -1, 1.5, NaN, Infinity]) {
		const inventory = new Inventory();
		assert.equal(inventory.add("coal", amount), false);
		assert.equal(inventory.remove("coal", amount), false);
	}
});

test("GRID-01 volume girado junto ao limite", () => {
	const buildings = new Buildings();
	assert.equal(buildings.check(machine("assembler"), at(17, 10, 0)), "OK");
	assert.equal(buildings.check(machine("assembler"), at(18, 10, 0)), "OUT_OF_BOUNDS");
	assert.equal(buildings.check(machine("assembler"), at(18, 10, 1)), "OK");
});

test("sobreposição, área reservada e veio recusam sem débito", () => {
	const w = world();
	w.inventory.add("iron_ore", 30);
	const build = (id, cx, cz) => w.act({ kind: "build", machine: id, ...at(cx, cz) });
	assert.equal(build("miner", 10, 0), "OK");
	assert.equal(w.inventory.get("iron_ore"), 24);
	assert.equal(build("belt", 11, 1), "CELL_OCCUPIED");
	assert.equal(build("belt", 0, -1), "RESERVED_AREA");
	assert.equal(build("miner", 15, 15), "NO_VEIN");
	assert.equal(build("generator", 15, 15), "NOT_AUTHORIZED");
	assert.equal(w.inventory.get("iron_ore"), 24);
});

test("custo insuficiente não ocupa o grid", () => {
	const w = world();
	w.inventory.add("iron_ore", 5);
	assert.equal(w.act({ kind: "build", machine: "miner", ...at(10, 0) }), "INSUFFICIENT_ITEMS");
	assert.equal(w.facility.buildings.check(machine("miner"), at(10, 0)), "OK");
});

test("longe ou sem ser membro, nada muda", () => {
	const w = world();
	w.inventory.add("iron_ore", 30);
	w.act({ kind: "build", machine: "storage", ...at(15, 15) });
	const structureId = w.find("storage").id;
	const before = w.inventory.get("iron_ore");
	const as = (changes, action) => w.facility.execute({ ...w.actor, ...changes }, action);
	assert.equal(as({ isNear: () => false }, { kind: "remove", structureId }), "TOO_FAR");
	assert.equal(as({ userId: 8 }, { kind: "remove", structureId }), "NOT_MEMBER");
	assert.equal(w.act({ kind: "remove", structureId: w.find("generator").id }), "NOT_AUTHORIZED");
	assert.equal(w.inventory.get("iron_ore"), before);
});

test("linha de referência cabe nos 30 minérios e entrega componente sem intervenção", () => {
	const w = poweredLine();
	assert.equal(w.inventory.get("iron_ore"), 4);
	w.run(60);
	assert.ok(w.state("storage").stock.component >= 1);
	assert.equal(w.facility.factory.automationDone, true);
	assert.deepEqual(w.facility.factory.energy.supply, 30);
});

test("componente colocado à mão não conta como produção automática", () => {
	const w = world();
	w.inventory.add("iron_ore", 2);
	w.inventory.add("component", 1);
	w.act({ kind: "build", machine: "storage", ...at(15, 15) });
	assert.equal(w.act({ kind: "insert", structureId: w.find("storage").id, item: "component", amount: 1 }), "OK");
	w.run(5);
	assert.equal(w.facility.factory.automationDone, false);
});

test("FACT-01 um ciclo consome e produz uma vez", () => {
	const w = poweredLine([["furnace", 15, 15]]);
	const structureId = w.find("furnace").id;
	w.act({ kind: "insert", structureId, item: "iron_ore", amount: 1 });
	w.run(2.8);
	assert.equal(w.state("furnace").output.iron_bar ?? 0, 0);
	w.run(0.4);
	assert.equal(w.state("furnace").output.iron_bar, 1);
	w.run(10);
	assert.deepEqual(w.facility.factory.contents(structureId), { iron_bar: 1 });
});

test("FACT-02 armazém cheio interrompe a linha e ela retoma sem perder itens", () => {
	const w = poweredLine();
	const storage = w.find("storage").id;
	const state = w.facility.factory.state(storage);
	state.stock.coal = 32;
	w.run(200);
	assert.equal(state.stock.component ?? 0, 0);
	assert.equal(w.state("assembler").status, "output_full");
	assert.equal(w.state("miner").status, "output_full");
	const stuck = ironIn(w.facility);
	w.run(20);
	assert.equal(ironIn(w.facility), stuck);
	assert.equal(w.act({ kind: "extract", structureId: storage }), "OK");
	w.run(20);
	assert.ok(state.stock.component >= 1);
	assert.ok(ironIn(w.facility) >= stuck);
});

test("nenhum item é criado ou perdido na linha", () => {
	const w = poweredLine();
	const miner = w.find("miner").id;
	w.run(30);
	assert.equal(w.act({ kind: "toggle", structureId: miner, enabled: false }), "OK");
	const before = ironIn(w.facility);
	for (let i = 0; i < 300; i++) {
		w.run(0.2);
		assert.equal(ironIn(w.facility), before);
	}
});

test("FACT-03 falta de energia pausa e retoma do mesmo ponto", () => {
	const w = poweredLine([["furnace", 15, 15]]);
	w.act({ kind: "insert", structureId: w.find("furnace").id, item: "iron_ore", amount: 1 });
	w.run(1);
	const generator = w.find("generator").id;
	w.act({ kind: "toggle", structureId: generator, enabled: false });
	const progress = w.state("furnace").progress;
	w.run(10);
	assert.equal(w.state("furnace").status, "no_power");
	assert.equal(w.state("furnace").progress, progress);
	w.act({ kind: "toggle", structureId: generator, enabled: true });
	w.run(2.2);
	assert.equal(w.state("furnace").output.iron_bar, 1);
});

test("um carvão sustenta 60 s e o gerador para sem combustível", () => {
	const w = world();
	w.inventory.add("iron_ore", 2);
	w.inventory.add("coal", 1);
	const structureId = w.find("generator").id;
	w.run(1);
	assert.equal(w.state("generator").status, "damaged");
	w.act({ kind: "restore", structureId });
	w.act({ kind: "insert", structureId, item: "coal", amount: 1 });
	w.run(59.8);
	assert.equal(w.state("generator").status, "working");
	w.run(0.6);
	assert.equal(w.state("generator").status, "no_fuel");
	assert.equal(w.facility.factory.energy.supply, 0);
});

test("energia é concedida inteira, em ordem de ID", () => {
	const line = [0, 3, 6, 9].map((x) => ["furnace", 8 + x, 15]);
	const w = poweredLine(line);
	for (const structure of w.facility.buildings.all()) {
		if (structure.machine === "furnace") w.facility.factory.insert(structure.id, "iron_ore", 1);
	}
	w.run(0.2);
	const statuses = w.facility.buildings
		.all()
		.filter((structure) => structure.machine === "furnace")
		.map((structure) => w.facility.factory.state(structure.id).status);
	assert.deepEqual(statuses, ["working", "working", "working", "no_power"]);
	assert.deepEqual(w.facility.factory.energy, { supply: 30, demand: 40, granted: 30 });
});

test("GRID-02 remover máquina cheia sem espaço preserva tudo", () => {
	const w = poweredLine();
	w.run(60);
	const storage = w.find("storage").id;
	const held = w.facility.factory.contents(storage);
	w.inventory.add("component", w.inventory.space("component"));
	const iron = w.inventory.get("iron_ore");
	assert.equal(w.act({ kind: "remove", structureId: storage }), "INVENTORY_FULL");
	assert.deepEqual(w.facility.factory.contents(storage), held);
	assert.equal(w.inventory.get("iron_ore"), iron);
});

test("remover devolve custo, buffers e lote reservado uma vez", () => {
	const w = poweredLine([["furnace", 15, 15]]);
	const structureId = w.find("furnace").id;
	const before = w.inventory.get("iron_ore");
	w.act({ kind: "insert", structureId, item: "iron_ore", amount: 3 });
	w.run(1);
	assert.equal(w.act({ kind: "remove", structureId }), "OK");
	assert.equal(w.inventory.get("iron_ore"), before + 4);
	assert.equal(w.act({ kind: "remove", structureId }), "NOT_FOUND");
});

test("GRID-03 reposicionar preserva ID, itens e progresso e reconfigura portas", () => {
	const w = poweredLine();
	w.run(20);
	const { id } = w.find("assembler");
	const held = w.facility.factory.contents(id);
	const progress = w.state("assembler").progress;
	const total = ironIn(w.facility);
	assert.equal(w.act({ kind: "move", structureId: id, ...at(15, -14, 1) }), "OK");
	assert.equal(w.find("assembler").id, id);
	assert.deepEqual(w.facility.factory.contents(id), held);
	assert.equal(w.state("assembler").progress, progress);
	assert.equal(ironIn(w.facility), total);
	assert.equal(w.act({ kind: "move", structureId: id, ...at(10, 8, 2) }), "OK");
	w.run(60);
	assert.ok(w.state("storage").stock.component >= 1);
});

test("mover para célula ocupada mantém a posição original", () => {
	const w = poweredLine();
	const { id, cx, cz } = w.find("storage");
	assert.equal(w.act({ kind: "move", structureId: id, ...at(10, 4) }), "CELL_OCCUPIED");
	assert.deepEqual([w.find("storage").cx, w.find("storage").cz], [cx, cz]);
	assert.equal(w.act({ kind: "move", structureId: id, ...at(cx + 1, cz) }), "OK");
});

test("curva leva o item e esteira aceita só uma entrada", () => {
	const buildings = new Buildings();
	const first = buildings.place(machine("belt"), at(15, 15, 2), 7);
	const corner = buildings.place(machine("belt"), at(15, 16, 1), 7);
	const last = buildings.place(machine("belt"), at(16, 16, 1), 7);
	const side = buildings.place(machine("belt"), at(16, 15, 2), 7);
	const factory = new Factory(buildings);
	factory.state(first.id).item = "coal";
	factory.state(side.id).item = "iron_ore";
	for (let i = 0; i < 2; i++) factory.step();
	assert.equal(factory.state(corner.id).item, "coal");
	for (let i = 0; i < 2; i++) factory.step();
	assert.equal(factory.state(last.id).item, "coal");
	assert.equal(factory.state(side.id).item, "iron_ore");
});

test("SAVE-01 snapshot com lote, item em trânsito e estoque volta igual", () => {
	const w = world();
	w.inventory.add("iron_ore", 30);
	w.inventory.add("coal", 6);
	const generator = w.find("generator").id;
	w.act({ kind: "restore", structureId: generator });
	w.act({ kind: "insert", structureId: generator, item: "coal", amount: 6 });
	for (const [id, cx, cz] of LINE) w.act({ kind: "build", machine: id, ...at(cx, cz, 2) });
	w.run(23.4);
	const loaded = reload(w.facility);
	assert.deepEqual(loaded.buildings.snapshot(), w.facility.buildings.snapshot());
	assert.equal(JSON.stringify(loaded.factory.snapshot()), JSON.stringify(w.facility.factory.snapshot()));
	assert.equal(ironIn(loaded), ironIn(w.facility));
	assert.deepEqual(loaded.research.state(), w.facility.research.state());
});

test("SAVE-02 snapshot inconsistente ou futuro é recusado", () => {
	const belt = { id: 1, machine: "belt", ownerId: 1, cx: 9, cz: 9, rotation: 0 };
	assert.throws(() => Buildings.restore({ nextId: 3, structures: [belt, { ...belt, id: 2 }] }));
	assert.throws(() => Buildings.restore({ nextId: 1, structures: [belt] }));
	const good = copy(poweredLine().facility.snapshot());
	assert.equal(isValidWorld(good), true);
	assert.equal(isValidWorld({ ...good, schemaVersion: 5 }), false);
	for (const value of [undefined, 5, {}, { ...good, factory: { machines: [] } }]) assert.equal(isValidWorld(value), false);
	const negative = copy(good);
	negative.factory.machines[2].state.input = { coal: -1 };
	assert.equal(isValidWorld(negative), false);
	const unknown = copy(good);
	unknown.factory.machines[2].state.stock = { gold: 1 };
	assert.equal(isValidWorld(unknown), false);
});

test("TECH-01 pesquisa exige produção automática, cobra uma vez e conclui uma vez", () => {
	const w = world();
	const { research } = w.facility;
	w.inventory.add("component", 2);
	assert.equal(w.facility.startResearch(w.actor, noFacts), "MISSING_PREREQUISITE");
	assert.equal(w.inventory.get("component"), 2);
	w.facility.factory.automationDone = true;
	assert.equal(w.facility.startResearch(w.actor, noFacts), "OK");
	assert.equal(w.facility.startResearch(w.actor, noFacts), "RESEARCH_BUSY");
	assert.equal(w.inventory.get("component"), 1);
	assert.equal(research.update(9.9), undefined);
	assert.equal(research.update(0.2), "maintenance_access");
	assert.equal(research.update(10), undefined);
	assert.equal(w.facility.startResearch(w.actor, noFacts), "MISSING_PREREQUISITE");
	const withRecord = new Set(["guardian_record"]);
	assert.equal(w.facility.startResearch(w.actor, withRecord), "INSUFFICIENT_ITEMS");
	w.inventory.add("ancient_fragment", 1);
	assert.equal(w.facility.startResearch(w.actor, withRecord), "OK");
	assert.deepEqual([w.inventory.get("component"), w.inventory.get("ancient_fragment")], [0, 0]);
	assert.equal(research.update(15.1), "signal_reading");
	assert.equal(w.facility.startResearch(w.actor, withRecord), "ALREADY_DONE");
});

test("TECH-01 sem componente a pesquisa não começa e o andamento volta do snapshot", () => {
	const w = world();
	w.facility.factory.automationDone = true;
	assert.equal(w.facility.startResearch(w.actor, noFacts), "INSUFFICIENT_ITEMS");
	w.inventory.add("component", 1);
	w.facility.startResearch(w.actor, noFacts);
	w.facility.research.update(4);
	const loaded = reload(w.facility);
	assert.equal(loaded.research.update(5.9), undefined);
	assert.equal(loaded.research.update(0.2), "maintenance_access");
});

test("mineração respeita cadência, esgota, reaparece e não estoura o inventário", () => {
	const mining = new Mining();
	const inventory = new Inventory(10);
	mining.define("a", { item: "iron_ore", amount: 3, hits: 2, respawnSeconds: 60 });
	assert.equal(mining.hit("b", 7, inventory, 0).reason, "NOT_FOUND");
	assert.deepEqual(mining.hit("a", 7, inventory, 1), { reason: "OK", depleted: false });
	assert.equal(mining.hit("a", 7, inventory, 1.2).reason, "TOO_SOON");
	assert.deepEqual(mining.hit("a", 7, inventory, 1.5), { reason: "OK", depleted: true });
	assert.equal(mining.hit("a", 7, inventory, 2).reason, "DEPLETED");
	mining.undefine("a");
	mining.define("a", { item: "iron_ore", amount: 3, hits: 2, respawnSeconds: 60 });
	assert.equal(mining.isDepleted("a", 30), true);
	assert.equal(mining.hit("a", 7, inventory, 62).reason, "OK");
	assert.equal(mining.hit("a", 7, inventory, 63).reason, "OK");
	assert.equal(inventory.get("iron_ore"), 10);
	mining.define("c", { item: "iron_ore", amount: 3, hits: 0, respawnSeconds: 0 });
	assert.equal(mining.hit("c", 7, inventory, 64).reason, "INVENTORY_FULL");
});

test("sessão volta do documento e o excedente da extração espera espaço", () => {
	const session = new Session();
	session.inventory.add("coal", 195);
	session.suppliesReady = true;
	session.credit({ coal: 20, ancient_fragment: 1 }, ["guardian_record"]);
	assert.equal(session.inventory.get("coal"), 200);
	const loaded = Session.restore(copy(session.data()));
	assert.deepEqual(loaded.data(), session.data());
	assert.equal(loaded.claimRecovery(), false);
	loaded.inventory.remove("coal", 50);
	assert.equal(loaded.claimRecovery(), true);
	assert.equal(loaded.inventory.get("coal"), 165);
	assert.deepEqual(loaded.data().recovery, {});
	assert.deepEqual(loaded.data().facts, ["guardian_record"]);
});

test("missões avançam por fatos e terminam no capítulo", () => {
	const state = { suppliesReady: false, generatorRestored: false, automationDone: false, research: { completed: [], left: 0 }, facts: [] };
	const seen = [];
	const steps = [
		{ suppliesReady: true },
		{ generatorRestored: true },
		{ automationDone: true },
		{ research: { completed: ["maintenance_access"], left: 0 } },
		{ facts: ["guardian_record"] },
		{ facts: ["guardian_record", "chapter_one_done"] },
	];
	for (const step of steps) {
		seen.push(story.currentMission(state).id);
		Object.assign(state, step);
	}
	assert.deepEqual(seen, story.MISSIONS.map((mission) => mission.id));
	assert.equal(story.currentMission(state), undefined);
});

test("atraso acumulado é limitado", () => {
	assert.equal(world().facility.update(60), 5);
});

test("prévia centra a máquina no ponto em todas as rotações", () => {
	for (const type of catalog.MACHINES) {
		for (let rotation = 0; rotation < 4; rotation++) {
			const placement = grid.placementAt(type, new Vector3(50, 0, 50), rotation);
			const center = grid.placementCenter(type, placement);
			assert.ok(Math.abs(center.X - 50) <= 2 && Math.abs(center.Z - 50) <= 2, type.id);
		}
	}
});

test("NET-01 campos inválidos são recusados e extras, ignorados", () => {
	const action = { kind: "build", machine: "belt", cx: 1, cz: 1, rotation: 0 };
	const command = (changes) => ({ kind: "act", requestId: 1, action: { ...action, ...changes } });
	assert.deepEqual(parseCommand({ ...command({ extra: 1 }), extra: 1 }), command({}));
	const invalid = [{ cx: 1.5 }, { cx: NaN }, { cx: 1e9 }, { rotation: 4 }, { machine: "tank" }, { kind: "hack" }];
	for (const changes of invalid) assert.equal(parseCommand(command(changes)), undefined);
	for (const payload of [null, 5, "x", {}, { ...command({}), requestId: 0 }]) {
		assert.equal(parseCommand(payload), undefined);
	}
	const insert = { kind: "insert", structureId: 1, item: "coal", amount: 5 };
	assert.deepEqual(parseCommand({ kind: "act", requestId: 2, action: insert }).action, insert);
	for (const amount of [0, -5, 1.5, 1e6]) {
		assert.equal(parseCommand({ kind: "act", requestId: 2, action: { ...insert, amount } }), undefined);
	}
});

