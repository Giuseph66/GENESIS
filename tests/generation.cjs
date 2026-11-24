const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./runtime.cjs");

Array.prototype.isEmpty ??= function () {
	return this.length === 0;
};
math.clamp ??= (value, min, max) => Math.min(max, Math.max(min, value));

const { generate, validateLayout, fallbackLayout, populate, Stream, isInsideRoom, MAX_CANDIDATES } = load("server/generation");
const { TEMPLATES } = load("server/expedition-templates");
const { UPGRADES } = load("shared/expedition");

const SEEDS = Array.from({ length: 100 }, (_, index) => index * 7919 + 13);

/** Forma comparável: o módulo vira o ID. */
function shape(expedition) {
	const { rooms, doors } = expedition.layout;
	return { rooms: rooms.map(({ template, ...room }) => ({ ...room, template: template.id })), doors };
}

test("RUN-01 mesma seed repete salas, inimigos, saque e ofertas", () => {
	for (const seed of [1, 42, 99991]) {
		const [first, second] = [generate(seed).expedition, generate(seed).expedition];
		assert.deepEqual(shape(first), shape(second));
		assert.deepEqual(first.contents, second.contents);
	}
});

test("RUN-01 seeds diferentes variam", () => {
	const shapes = new Set(SEEDS.slice(0, 20).map((seed) => JSON.stringify(shape(generate(seed).expedition))));
	assert.ok(shapes.size > 10, `${shapes.size} formas`);
});

test("RUN-02 100 seeds entregam setor navegável com entrada segura, chefe e saída", () => {
	let fallbacks = 0;
	let branches = 0;
	const sizes = new Set();
	for (const seed of SEEDS) {
		const { expedition, problems } = generate(seed);
		assert.ok(expedition, problems.join(" | "));
		assert.deepEqual(validateLayout(expedition.layout), []);
		const { rooms } = expedition.layout;
		sizes.add(rooms.length);
		if (expedition.usedFallback) fallbacks += 1;
		if (rooms.some((room) => room.kind === "depot")) branches += 1;
		for (const content of expedition.contents) {
			const room = rooms.find((candidate) => candidate.id === content.roomId);
			for (const enemy of content.enemies) assert.ok(isInsideRoom(room, enemy.position, 6));
			if (room.kind === "entry" || room.kind === "upgrade" || room.kind === "extraction") {
				assert.deepEqual(content.enemies, []);
			}
			if (room.kind === "encounter") assert.ok(content.enemies.length >= 2);
			if (room.kind === "boss") assert.deepEqual(content.enemies.map((enemy) => enemy.kind), ["guardian"]);
		}
	}
	assert.ok(fallbacks < 10, `contingências: ${fallbacks}`);
	assert.ok(branches > 30, `ramificações: ${branches}`);
	assert.deepEqual([...sizes].sort((a, b) => a - b).join(), "5,6,7");
});

test("ofertas têm três efeitos diferentes", () => {
	for (const seed of SEEDS) {
		const offers = generate(seed).expedition.contents.map((content) => content.offer).filter((offer) => offer.length > 0);
		assert.equal(offers.length, 1);
		const effects = offers[0].map((id) => UPGRADES.find((upgrade) => upgrade.id === id).effect);
		assert.equal(new Set(effects).size, 3);
	}
});

test("sala não muda quando só o conteúdo muda", () => {
	const { layout, contents } = generate(42).expedition;
	assert.notDeepEqual(populate(layout, 43), contents);
	assert.deepEqual(populate(layout, 42), contents);
	const layoutStream = new Stream(42, 1);
	const lootStream = new Stream(42, 3);
	assert.notEqual(layoutStream.next(), lootStream.next());
});

test("RUN-03 sem encaixe, usa a contingência registrada e validada", () => {
	const templates = TEMPLATES.filter((template) => template.kind !== "upgrade" && template.id !== "encounter_hall").map(
		(template) => (template.kind === "boss" ? { ...template, entry: { side: 2, offset: 0, width: 10 } } : template),
	);
	const { expedition, problems, attempts } = generate(5, { templates });
	assert.equal(attempts, MAX_CANDIDATES);
	assert.equal(expedition.usedFallback, true);
	assert.equal(problems.length, MAX_CANDIDATES);
	assert.deepEqual(validateLayout(expedition.layout), []);
});

test("RUN-03 com a contingência inválida, recusa a expedição", () => {
	const missing = generate(5, { templates: [], fallback: () => undefined });
	assert.equal(missing.expedition, undefined);
	const broken = () => {
		const layout = fallbackLayout();
		return { ...layout, doors: layout.doors.slice(1) };
	};
	const invalid = generate(5, { templates: [], fallback: broken });
	assert.equal(invalid.expedition, undefined);
	assert.match(invalid.problems.at(-1), /inalcançável/);
});

test("validação recusa sobreposição, porta torta e atalho sem chefe", () => {
	const { rooms, doors } = fallbackLayout();
	const moved = rooms.map((room, index) => (index === 2 ? { ...room, z: room.z + 8 } : room));
	assert.ok(validateLayout({ rooms: moved, doors }).some((problem) => /sobrepostas/.test(problem)));
	const crooked = doors.map((door, index) => (index === 0 ? { ...door, x: 4 } : door));
	assert.ok(validateLayout({ rooms, doors: crooked }).some((problem) => /desalinhada/.test(problem)));
	const shortcut = [...doors, { from: 1, to: 6, x: 0, z: 0, side: 0, width: 14 }];
	assert.ok(validateLayout({ rooms, doors: shortcut }).some((problem) => /sem passar pelo chefe/.test(problem)));
});

test("fluxo aleatório fica na faixa e cobre os extremos", () => {
	const stream = new Stream(7, 1);
	const seen = new Set();
	for (let i = 0; i < 2000; i++) {
		const value = stream.integer(1, 6);
		assert.ok(value >= 1 && value <= 6);
		seen.add(value);
	}
	assert.equal(seen.size, 6);
});
