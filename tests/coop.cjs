const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./runtime.cjs");

const { Inventory } = load("server/inventory");
const { Facility } = load("server/facility");
const { Permissions } = load("server/permissions");
const { isValidWorld, restoreWorld } = load("server/snapshot");
const { parseCommand } = load("server/commands");

const OWNER = 7;
const GUEST = 8;
const view = { show: () => {}, hide: () => {} };
const copy = (value) => JSON.parse(JSON.stringify(value));

function actor(userId, iron = 30) {
	const inventory = new Inventory();
	if (iron > 0) inventory.add("iron_ore", iron);
	return { userId, inventory, isNear: () => true };
}

function join(permissions, userId = GUEST) {
	assert.equal(permissions.invite(OWNER, userId, 0), "OK");
	assert.equal(permissions.answer(userId, true, 1), "OK");
}

const belt = { kind: "build", machine: "belt", cx: 10, cz: 12, rotation: 0 };

test("visitante não altera a instalação", () => {
	const facility = new Facility(OWNER, undefined, view);
	const guest = actor(GUEST);
	assert.equal(facility.execute(guest, belt), "NOT_MEMBER");
	assert.equal(guest.inventory.get("iron_ore"), 30);
});

test("convite exige dono, vence, é consumido e respeita a lotação", () => {
	const permissions = new Permissions(OWNER);
	assert.equal(permissions.invite(GUEST, 9, 0), "NOT_AUTHORIZED");
	assert.equal(permissions.answer(GUEST, true, 0), "INVITE_EXPIRED");
	permissions.invite(OWNER, GUEST, 0);
	assert.equal(permissions.answer(GUEST, true, 61), "INVITE_EXPIRED");
	permissions.invite(OWNER, GUEST, 100);
	assert.equal(permissions.answer(GUEST, false, 101), "OK");
	assert.equal(permissions.role(GUEST), "visitor");
	assert.equal(permissions.answer(GUEST, true, 102), "INVITE_EXPIRED");
	for (const id of [8, 9]) join(permissions, id);
	// Dois convites abertos para a última vaga: só o primeiro aceite entra.
	permissions.invite(OWNER, 10, 0);
	permissions.invite(OWNER, 11, 0);
	assert.equal(permissions.answer(10, true, 1), "OK");
	assert.equal(permissions.answer(11, true, 1), "PARTY_FULL");
	assert.equal(permissions.invite(OWNER, 12, 2), "PARTY_FULL");
});

test("só o dono concede; membro não se promove nem expulsa outro", () => {
	const permissions = new Permissions(OWNER);
	join(permissions, 8);
	join(permissions, 9);
	assert.equal(permissions.setGrant(8, 8, "remove", true), "NOT_AUTHORIZED");
	assert.equal(permissions.expel(8, 9), "NOT_AUTHORIZED");
	assert.equal(permissions.expel(8, 8), "OK");
	assert.equal(permissions.role(8), "visitor");
	assert.equal(permissions.setGrant(OWNER, 9, "remove", true), "OK");
	assert.equal(permissions.can(9, "remove"), true);
	assert.equal(permissions.expel(OWNER, OWNER), "NOT_FOUND");
});

test("COOP-01 dois membros disputam a mesma célula: um constrói e um paga", () => {
	const facility = new Facility(OWNER, undefined, view);
	join(facility.permissions);
	const [owner, guest] = [actor(OWNER), actor(GUEST)];
	assert.equal(facility.execute(guest, belt), "OK");
	assert.equal(facility.execute(owner, belt), "CELL_OCCUPIED");
	assert.deepEqual([guest.inventory.get("iron_ore"), owner.inventory.get("iron_ore")], [29, 30]);
});

test("COOP-01 dois membros disputam o mesmo estoque sem duplicar", () => {
	const facility = new Facility(OWNER, undefined, view);
	join(facility.permissions);
	const [owner, guest] = [actor(OWNER), actor(GUEST, 0)];
	facility.execute(owner, { kind: "build", machine: "storage", cx: 12, cz: 12, rotation: 0 });
	const structureId = facility.buildings.all()[1].id;
	owner.inventory.add("component", 3);
	facility.execute(owner, { kind: "insert", structureId, item: "component", amount: 3 });
	assert.equal(facility.execute(guest, { kind: "extract", structureId }), "OK");
	assert.equal(facility.execute(owner, { kind: "extract", structureId }), "NOTHING_TO_TAKE");
	assert.equal(guest.inventory.get("component") + owner.inventory.get("component"), 3);
});

test("COOP-02 permissão retirada antes da aplicação recusa a ação", () => {
	const facility = new Facility(OWNER, undefined, view);
	join(facility.permissions);
	const guest = actor(GUEST);
	assert.equal(facility.execute(guest, belt), "OK");
	const structureId = facility.buildings.all()[1].id;
	assert.equal(facility.execute(guest, { kind: "remove", structureId }), "NOT_AUTHORIZED");
	facility.permissions.setGrant(OWNER, GUEST, "remove", true);
	facility.permissions.setGrant(OWNER, GUEST, "build", false);
	assert.equal(facility.execute(guest, { ...belt, cx: 11 }), "NOT_AUTHORIZED");
	assert.equal(guest.inventory.get("iron_ore"), 29);
	assert.equal(facility.execute(guest, { kind: "remove", structureId }), "OK");
	facility.permissions.expel(OWNER, GUEST);
	assert.equal(facility.execute(guest, belt), "NOT_MEMBER");
	assert.equal(guest.inventory.get("iron_ore"), 30);
});

test("membro autorizado remove construção de outro, nunca a fixa", () => {
	const facility = new Facility(OWNER, undefined, view);
	join(facility.permissions);
	facility.permissions.setGrant(OWNER, GUEST, "remove", true);
	facility.execute(actor(OWNER), belt);
	const guest = actor(GUEST);
	assert.equal(facility.execute(guest, { kind: "remove", structureId: facility.buildings.all()[1].id }), "OK");
	assert.equal(facility.execute(guest, { kind: "remove", structureId: 1 }), "NOT_AUTHORIZED");
});

test("permissões voltam do snapshot e a versão 3 migra sem membros", () => {
	const facility = new Facility(OWNER, undefined, view);
	join(facility.permissions);
	facility.permissions.setGrant(OWNER, GUEST, "transfer", false);
	const saved = copy(facility.snapshot());
	const loaded = new Facility(OWNER, saved, view);
	assert.deepEqual(loaded.permissions.snapshot(), facility.permissions.snapshot());

	const { permissions, ...old } = copy(facility.snapshot());
	const solo = { ...old, schemaVersion: 3 };
	assert.equal(isValidWorld(solo), true);
	assert.deepEqual(restoreWorld(solo, OWNER).permissions.memberIds(), []);
});

test("snapshot com membro repetido, dono como membro ou excesso é recusado", () => {
	const member = (userId) => ({ userId, build: true, remove: false, transfer: true });
	for (const members of [[member(8), member(8)], [member(OWNER)], [8, 9, 10, 11].map(member), [{ userId: 8 }]]) {
		assert.throws(() => Permissions.restore(OWNER, { members }));
	}
});

test("NET-01 comandos de grupo validam tipos", () => {
	const parse = (action) => parseCommand({ kind: "act", requestId: 1, action })?.action;
	assert.deepEqual(parse({ kind: "invite", userId: -1, extra: 1 }), { kind: "invite", userId: -1 });
	assert.deepEqual(parse({ kind: "answer", accept: false }), { kind: "answer", accept: false });
	const grant = { kind: "grant", userId: 8, grant: "build", enabled: true };
	assert.deepEqual(parse(grant), grant);
	for (const action of [{ kind: "invite" }, { kind: "answer" }, { ...grant, grant: "admin" }, { ...grant, enabled: 1 }, { kind: "expel", userId: 1.5 }]) {
		assert.equal(parse(action), undefined);
	}
});
