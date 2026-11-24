const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./runtime.cjs");

const { ENEMIES, PLAYER_ATTACKS, isInsideAttack } = load("shared/combat");
const { Fighter } = load("shared/fighter");
const { Enemy } = load("server/enemy");

const origin = { x: 0, z: 0 };
const forward = { x: 0, z: 1 };
const at = (x, z) => ({ x, z });

/** Avança o inimigo com passos fixos, move o corpo em linha reta e junta os eventos. */
function simulate(enemy, from, seconds, perceive) {
	const events = [];
	const steps = Math.round(seconds / 0.05);
	for (let i = 1; i <= steps; i++) {
		const now = from + i * 0.05;
		const event = enemy.update(now, perceive(now, enemy));
		if (event) events.push({ ...event, now });
		const goal = enemy.destination;
		if (!goal) continue;
		const distance = Math.hypot(goal.x - enemy.position.x, goal.z - enemy.position.z);
		const walk = Math.min(distance, enemy.kind.speed * 0.05);
		if (distance > 0.001) {
			enemy.position = {
				x: enemy.position.x + ((goal.x - enemy.position.x) / distance) * walk,
				z: enemy.position.z + ((goal.z - enemy.position.z) / distance) * walk,
			};
		}
	}
	return events;
}

test("COM-01 alcance, arco e linha delimitam o golpe", () => {
	const { primary, secondary } = PLAYER_ATTACKS;
	assert.equal(isInsideAttack(primary, origin, forward, at(0, 7.9)), true);
	assert.equal(isInsideAttack(primary, origin, forward, at(0, 8.1)), false);
	assert.equal(isInsideAttack(primary, origin, forward, at(0, -3)), false);
	assert.equal(isInsideAttack(primary, origin, forward, at(5, 1)), false);
	assert.equal(isInsideAttack(secondary, origin, forward, at(2, 40)), true);
	assert.equal(isInsideAttack(secondary, origin, forward, at(3, 40)), false);
	assert.equal(isInsideAttack(secondary, origin, forward, at(0, -5)), false);
	assert.equal(isInsideAttack(ENEMIES.guardian.attacks[1], origin, forward, at(0, -16)), true);
});

test("COM-01 ataque antes da recarga é recusado", () => {
	const fighter = new Fighter();
	assert.equal(fighter.attack("primary", 10), true);
	assert.equal(fighter.attack("primary", 10.5), false);
	assert.equal(fighter.attack("primary", 10.56), true);
	assert.equal(fighter.attack("secondary", 10.5), true);
	assert.equal(fighter.attack("secondary", 14.4), false);
});

test("COM-01 esquiva sem resistência ou em recarga é recusada", () => {
	const fighter = new Fighter();
	assert.equal(fighter.dodge(10), true);
	assert.equal(fighter.dodge(10.5), false);
	let used = 1;
	for (let now = 11; now < 40 && fighter.dodge(now); now += 1) used += 1;
	assert.ok(used >= 4 && used < 20, `esquivas: ${used}`);
});

test("resistência espera 0,75 s e regenera até o limite", () => {
	const fighter = new Fighter();
	fighter.dodge(10);
	assert.equal(fighter.state(10.7).stamina, 75);
	assert.ok(Math.abs(fighter.state(11.25).stamina - 87.5) < 0.001);
	assert.equal(fighter.state(60).stamina, 100);
});

test("esquiva protege só na janela", () => {
	const fighter = new Fighter();
	fighter.dodge(10);
	assert.equal(fighter.isInvulnerable(10.3), true);
	assert.equal(fighter.isInvulnerable(10.4), false);
});

test("cliente reconcilia com o estado do servidor", () => {
	const [server, client] = [new Fighter(), new Fighter()];
	server.dodge(100);
	server.attack("secondary", 100);
	client.apply(server.state(100.1), 5);
	assert.equal(client.attack("secondary", 8), false);
	assert.equal(client.attack("secondary", 9), true);
	assert.equal(client.dodge(5.5), false);
});

test("inimigo avisa antes de todo golpe e respeita recuperação", () => {
	for (const kind of Object.values(ENEMIES)) {
		const enemy = new Enemy(kind, origin);
		const events = simulate(enemy, 0, 30, () => ({ position: at(0, 10), visible: true }));
		assert.ok(events.length >= 4, kind.id);
		events.forEach((event, index) => {
			assert.equal(event.kind, index % 2 === 0 ? "telegraph" : "strike");
			if (event.kind === "strike") {
				const wait = event.now - events[index - 1].now;
				assert.ok(wait >= event.swing.attack.windup - 0.001, kind.id);
			}
		});
	}
});

test("mira fica travada: sair da linha depois do aviso evita o tiro", () => {
	const enemy = new Enemy(ENEMIES.drone, origin);
	// O alvo sai para o lado assim que o aviso começa.
	const perceive = (now, self) => ({ position: self.state === "Attack" ? at(10, 20) : at(0, 20), visible: true });
	const [telegraph, strike] = simulate(enemy, 0, 6, perceive);
	assert.deepEqual(strike.swing, telegraph.swing);
	assert.equal(isInsideAttack(telegraph.swing.attack, telegraph.swing.origin, telegraph.swing.aim, at(0, 20)), true);
	assert.equal(isInsideAttack(telegraph.swing.attack, telegraph.swing.origin, telegraph.swing.aim, at(10, 20)), false);
});

test("perde o alvo, procura, recua e volta a patrulhar", () => {
	const enemy = new Enemy(ENEMIES.robot, origin);
	const states = new Set();
	simulate(enemy, 0, 40, (now, self) => {
		states.add(self.state);
		return now < 2 ? { position: at(0, 30), visible: true } : { position: at(0, 30), visible: false };
	});
	for (const state of ["Chase", "Search", "Retreat", "Idle", "Patrol"]) assert.ok(states.has(state), state);
});

test("limite de perseguição leva ao recuo", () => {
	const enemy = new Enemy(ENEMIES.robot, origin);
	const states = new Set();
	simulate(enemy, 0, 15, (now, self) => {
		states.add(self.state);
		return { position: at(0, self.position.z + 20), visible: true };
	});
	assert.ok(states.has("Retreat"));
});

test("Guardião encadeia golpes abaixo de metade da vida, com aviso inteiro", () => {
	const guardian = new Enemy(ENEMIES.guardian, origin);
	guardian.damage(200, 0);
	const events = simulate(guardian, 0, 6, () => ({ position: at(0, 8), visible: true }));
	assert.deepEqual(
		events.slice(0, 4).map((event) => event.kind),
		["telegraph", "strike", "telegraph", "strike"],
	);
	assert.ok(events[2].now - events[1].now <= 0.11);
	assert.ok(events[3].now - events[2].now >= events[2].swing.attack.windup - 0.001);
});

test("morto não ataca, não anda e não recebe dano", () => {
	const enemy = new Enemy(ENEMIES.robot, origin);
	simulate(enemy, 0, 1, () => ({ position: at(0, 6), visible: true }));
	assert.equal(enemy.damage(999, 1), 80);
	assert.equal(enemy.damage(10, 1), 0);
	assert.deepEqual(simulate(enemy, 1, 10, () => ({ position: at(0, 6), visible: true })), []);
	assert.equal(enemy.state, "Dead");
});

test("kit inicial derrota o Guardião em tempo razoável", () => {
	const fighter = new Fighter();
	const guardian = new Enemy(ENEMIES.guardian, origin);
	let now = 0;
	// Golpeia somente em metade do tempo, para deixar margem à esquiva.
	while (guardian.state !== "Dead" && now < 120) {
		now += 0.05;
		if (now % 4 < 2 && fighter.attack("primary", now)) guardian.damage(PLAYER_ATTACKS.primary.damage, now);
	}
	assert.ok(now > 10 && now < 60, `tempo: ${now.toFixed(1)} s`);
});
