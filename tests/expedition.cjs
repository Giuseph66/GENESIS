const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./runtime.cjs");

Array.prototype.isEmpty ??= function () {
	return this.length === 0;
};

const { Attempt, LOOT_LIMIT } = load("server/expedition-attempt");
const { Fighter } = load("shared/fighter");
const { PLAYER_ATTACKS } = load("shared/combat");
const { UPGRADES } = load("shared/expedition");

function active() {
	const attempt = new Attempt("a1");
	attempt.activate();
	return attempt;
}

function ready() {
	const attempt = active();
	attempt.addLoot({ ancient_fragment: 1 });
	attempt.bossDown(10);
	assert.equal(attempt.settleBoss(10.5), false);
	assert.equal(attempt.settleBoss(11), true);
	assert.equal(attempt.settleBoss(12), false);
	return attempt;
}

test("extração exige tentativa ativa e chefe confirmado", () => {
	const attempt = new Attempt("a1");
	assert.equal(attempt.beginExtraction(), false);
	attempt.activate();
	assert.equal(attempt.activate(), false);
	assert.equal(attempt.beginExtraction(), false);
	attempt.bossDown(0);
	assert.equal(attempt.beginExtraction(), false);
	attempt.settleBoss(1);
	assert.equal(attempt.beginExtraction(), true);
	assert.equal(attempt.beginExtraction(), false);
});

test("extração confirmada é terminal e preserva o saque creditado", () => {
	const attempt = ready();
	attempt.beginExtraction();
	assert.equal(attempt.resolveExtraction(true), true);
	assert.equal(attempt.phase, "Extracted");
	assert.equal(attempt.finish("died"), false);
	assert.equal(attempt.resolveExtraction(false), false);
	assert.deepEqual(attempt.clear(), {});
});

test("COM-02 morte antes da extração vence e recusa a extração", () => {
	const attempt = ready();
	assert.equal(attempt.finish("died"), true);
	assert.equal(attempt.beginExtraction(), false);
	assert.equal(attempt.finish("left"), false);
	assert.equal(attempt.endReason, "died");
	assert.deepEqual(attempt.clear(), { ancient_fragment: 1 });
	assert.deepEqual(attempt.lootCopy(), {});
});

test("COM-02 morte no meio da confirmação aguarda o resultado da escrita", () => {
	const credited = ready();
	credited.beginExtraction();
	assert.equal(credited.finish("died"), false);
	assert.equal(credited.resolveExtraction(true), true);
	assert.equal(credited.phase, "Extracted");

	const refused = ready();
	refused.beginExtraction();
	refused.finish("left");
	refused.finish("died");
	assert.equal(refused.resolveExtraction(false), false);
	assert.deepEqual([refused.phase, refused.endReason], ["Ended", "left"]);
});

test("recusa sem morte volta à tentativa ativa e permite tentar de novo", () => {
	const attempt = ready();
	attempt.beginExtraction();
	attempt.resolveExtraction(false);
	assert.equal(attempt.phase, "Active");
	assert.equal(attempt.beginExtraction(), true);
});

test("morrer na janela final do chefe não confirma a derrota", () => {
	const attempt = active();
	attempt.bossDown(10);
	attempt.finish("died");
	assert.equal(attempt.settleBoss(20), false);
	assert.equal(attempt.guardianDefeated, false);
});

test("mochila tem limite e só enche na tentativa ativa", () => {
	const attempt = active();
	assert.deepEqual(attempt.addLoot({ coal: LOOT_LIMIT - 1 }), { coal: LOOT_LIMIT - 1 });
	assert.deepEqual(attempt.addLoot({ coal: 5 }), { coal: 1 });
	assert.deepEqual(attempt.addLoot({ coal: 5 }), {});
	attempt.finish("left");
	assert.deepEqual(attempt.addLoot({ iron_ore: 5 }), {});
});

test("escolha de melhoria é validada, única e expira com a tentativa", () => {
	const attempt = active();
	assert.equal(attempt.choose(3, "damage_1"), undefined);
	assert.equal(attempt.openOffer(3, ["damage_1", "speed_1", "shield_1"]), true);
	assert.equal(attempt.openOffer(3, ["damage_3"]), false);
	assert.equal(attempt.choose(3, "damage_3"), undefined);
	assert.equal(attempt.choose(4, "damage_1"), undefined);
	assert.equal(attempt.choose(3, "damage_1").id, "damage_1");
	assert.equal(attempt.choose(3, "speed_1"), undefined);
	assert.deepEqual(attempt.upgradeList(), ["damage_1"]);
	attempt.finish("died");
	attempt.clear();
	assert.deepEqual(attempt.upgradeList(), []);
});

test("efeito repetido para em dois acúmulos", () => {
	const attempt = active();
	for (const roomId of [1, 2]) {
		attempt.openOffer(roomId, ["damage_1"]);
		assert.ok(attempt.choose(roomId, "damage_1"));
	}
	assert.equal(attempt.openOffer(3, ["damage_2", "speed_1"]), true);
	assert.deepEqual(attempt.offer(3).options, ["speed_1"]);
	assert.equal(attempt.choose(3, "damage_2"), undefined);
});

test("catálogo de melhorias cobre quatro efeitos com IDs únicos", () => {
	assert.equal(new Set(UPGRADES.map((upgrade) => upgrade.id)).size, UPGRADES.length);
	assert.equal(new Set(UPGRADES.map((upgrade) => upgrade.effect)).size, 4);
});

test("melhorias mudam dano, recarga e escudo do lutador", () => {
	const fighter = new Fighter();
	fighter.upgrade("damage", 0.25);
	assert.equal(fighter.damage("primary"), PLAYER_ATTACKS.primary.damage * 1.25);
	fighter.upgrade("recharge", 0.2);
	assert.equal(fighter.attack("secondary", 10), true);
	assert.equal(fighter.attack("secondary", 13.1), false);
	assert.equal(fighter.attack("secondary", 13.21), true);
	fighter.upgrade("shield", 25);
	assert.equal(fighter.absorb(10), 0);
	assert.equal(fighter.absorb(20), 5);
	assert.equal(fighter.absorb(20), 20);
	const client = new Fighter();
	client.apply(fighter.state(20), 5);
	assert.equal(client.damage("primary"), fighter.damage("primary"));
});
