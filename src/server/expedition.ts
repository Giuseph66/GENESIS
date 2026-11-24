import type { Counts } from "../shared/catalog";
import {
	AttackType,
	COMBAT_FX_REMOTE,
	COMBAT_REMOTE,
	COMBAT_SYNC_REMOTE,
	CombatCommand,
	CombatFx,
	Flat,
	FighterState,
	flatDistance,
	IN_ENCOUNTER,
	isInsideAttack,
	PLAYER_ATTACKS,
	PlayerAttackId,
} from "../shared/combat";
import {
	EndReason,
	EXPEDITION_COMMAND_REMOTE,
	EXPEDITION_NOTICE_REMOTE,
	EXPEDITION_STATE_REMOTE,
	ExpeditionCommand,
	ExpeditionState,
	ExtractionFacts,
	SPEED_SCALE,
} from "../shared/expedition";
import { Fighter } from "../shared/fighter";
import { REMOTES_FOLDER } from "../shared/protocol";
import { Enemy, Swing } from "./enemy";
import { Attempt } from "./expedition-attempt";
import { addPrompt, block, buildSector, Sector } from "./expedition-builder";
import { Body, createBody, moveEnemy, placeBody, showTelegraph } from "./expedition-enemies";
import { Door, Expedition, generate, isInsideRoom, Room, RoomContent, roomPoint } from "./generation";
import { livingRoot } from "./network";
import { getSession, takeToken } from "./session";

const http = game.GetService("HttpService");
const players = game.GetService("Players");
const replicatedStorage = game.GetService("ReplicatedStorage");
const runService = game.GetService("RunService");
const workspace = game.GetService("Workspace");

/** Área isolada, acima do terreno. Cada tentativa ocupa uma vaga ao longo de X. */
const ORIGIN = new Vector3(0, 900, -1200);
const SLOT_SPACING = 1400;
const STEP = 0.05;
const MAX_DELAY = 0.25;
/** Após o teletransporte, o cliente ainda pode enviar a posição antiga. */
const ENTRY_GRACE = 2;
const EYE_HEIGHT = 3;
/** Distância da borda para considerar que o jogador entrou na sala. */
const ENTER_MARGIN = 9;
const PUSH_SECONDS = 0.25;
/** Vida devolvida ao limpar um encontro. Proposta inicial para playtest. */
const CLEAR_HEAL = 40;
const MAX_SEED = 2147483646;

const CYAN = Color3.fromRGB(56, 201, 232);
const GREEN = Color3.fromRGB(88, 214, 120);
const YELLOW = Color3.fromRGB(232, 200, 72);

export interface ExpeditionOptions {
	/** Peça da base que recebe a interação de entrada. */
	readonly entrance: BasePart;
	/** Para onde o jogador volta. */
	readonly returnPoint: CFrame;
	/** Confere pesquisa e estado na base. Avise o jogador aqui ao recusar. */
	readonly canEnter: (player: Player) => boolean;
	/** Crédito durável e idempotente por `extractionId`. Pode esperar. Falso mantém a tentativa aberta. */
	readonly onExtracted: (player: Player, extractionId: string, loot: Counts, facts: ExtractionFacts) => boolean;
	readonly onEnded?: (player: Player, outcome: "extracted" | EndReason) => void;
}

interface Run {
	readonly player: Player;
	readonly slot: number;
	readonly attempt: Attempt;
	readonly fighter: Fighter;
	readonly expedition: Expedition;
	readonly sector: Sector;
	readonly bodies: Array<Body>;
	readonly entered: Set<number>;
	readonly cleared: Set<number>;
	readonly opened: Set<number>;
	enteredAt: number;
	room: Room;
	dirty: boolean;
	pushedAt: number;
	closing: boolean;
}

function parseCombat(payload: unknown): CombatCommand | undefined {
	if (!typeIs(payload, "table")) return undefined;
	const { kind, x, z } = payload as { kind?: unknown; x?: unknown; z?: unknown };
	if (kind !== "primary" && kind !== "secondary" && kind !== "dodge") return undefined;
	if (!typeIs(x, "number") || !typeIs(z, "number") || x !== x || z !== z) return undefined;
	const length = math.sqrt(x * x + z * z);
	if (length < 0.5 || length > 2) return undefined;
	return { kind, x: x / length, z: z / length };
}

function parseExpedition(payload: unknown): ExpeditionCommand | undefined {
	if (!typeIs(payload, "table")) return undefined;
	const { kind, roomId, upgrade } = payload as { kind?: unknown; roomId?: unknown; upgrade?: unknown };
	if (kind === "leave") return { kind: "leave" };
	if (kind !== "choose" || !typeIs(roomId, "number") || !typeIs(upgrade, "string")) return undefined;
	return upgrade.size() <= 32 ? { kind: "choose", roomId, upgrade } : undefined;
}

/** Expedições do Setor de Manutenção, uma instância por jogador. */
export function createExpeditions(options: ExpeditionOptions) {
	const container = new Instance("Folder");
	container.Name = "GenesisExpeditions";
	container.Parent = workspace;

	const remotes = replicatedStorage.WaitForChild(REMOTES_FOLDER);
	function remote(name: string): RemoteEvent {
		const event = new Instance("RemoteEvent");
		event.Name = name;
		event.Parent = remotes;
		return event;
	}
	const combatRemote = remote(COMBAT_REMOTE);
	const syncRemote = remote(COMBAT_SYNC_REMOTE) as RemoteEvent<(state: FighterState) => void>;
	const fxRemote = remote(COMBAT_FX_REMOTE) as RemoteEvent<(fx: CombatFx) => void>;
	const stateRemote = remote(EXPEDITION_STATE_REMOTE) as RemoteEvent<(state: ExpeditionState) => void>;
	const noticeRemote = remote(EXPEDITION_NOTICE_REMOTE) as RemoteEvent<(message: string) => void>;
	const commandRemote = remote(EXPEDITION_COMMAND_REMOTE);

	let runs = new Array<Run>();
	/** Jogadores com entrada em preparo, para recusar acionamento repetido. */
	const preparing = new Set<number>();

	function runOf(player: Player): Run | undefined {
		return runs.find((run) => run.player === player);
	}

	function contentOf(run: Run, roomId: number): RoomContent | undefined {
		return run.expedition.contents.find((content) => content.roomId === roomId);
	}

	function aliveIn(run: Run, roomId: number): number {
		return run.bodies.filter((body) => body.roomId === roomId && body.enemy.state !== "Dead").size();
	}

	function objectiveOf(run: Run): string {
		const { room, attempt } = run;
		if (attempt.phase === "Confirming") return "Confirmando a extração…";
		if (attempt.guardianDefeated) return "Vá ao elevador e extraia";
		if (aliveIn(run, room.id) > 0) return room.kind === "boss" ? "Derrote o Guardião Industrial" : "Elimine as máquinas hostis";
		if (attempt.offer(room.id)) return "Escolha uma melhoria";
		if (room.kind === "boss" && run.entered.has(room.id)) return "Confirmando a derrota do Guardião…";
		return room.kind === "boss" ? "Enfrente o Guardião Industrial" : "Siga pela porta aberta";
	}

	function stateOf(run: Run): ExpeditionState {
		const { attempt, room } = run;
		const guardian = run.bodies.find((body) => body.enemy.kind.id === "guardian" && body.enemy.state !== "Dead")?.enemy;
		return {
			phase: attempt.phase,
			objective: objectiveOf(run),
			room: run.cleared.size(),
			rooms: run.expedition.layout.rooms.size(),
			enemies: aliveIn(run, room.id),
			loot: attempt.lootCopy(),
			upgrades: attempt.upgradeList(),
			extraction: attempt.phase === "Confirming" ? "confirming" : attempt.guardianDefeated ? "available" : "locked",
			offer: attempt.offer(room.id),
			boss: guardian && { name: guardian.kind.name, health: guardian.health, max: guardian.kind.health },
		};
	}

	function doorsFrom(run: Run, roomId: number): Array<Door> {
		return run.expedition.layout.doors.filter((door) => door.from === roomId);
	}

	function doorInto(run: Run, roomId: number): Door | undefined {
		return run.expedition.layout.doors.find((door) => door.to === roomId);
	}

	function collect(run: Run, counts: Counts) {
		run.attempt.addLoot(counts);
		run.dirty = true;
	}

	/** Caixa com materiais. Entra na mochila da tentativa, sem tocar no saldo permanente. */
	function addCrate(run: Run, content: RoomContent, name: string) {
		const point = content.lootPoint;
		if (!point) return;
		const crate = block(run.sector.dynamic, name, new Vector3(4, 3, 3), run.sector.toWorld(point, 1.5), YELLOW, Enum.Material.DiamondPlate);
		addPrompt(crate, "Coletar", name, 0.6, (player) => {
			if (player !== run.player || run.attempt.phase !== "Active" || run.opened.has(content.roomId)) return;
			run.opened.add(content.roomId);
			crate.Destroy();
			collect(run, content.loot);
			if (content.ambush) {
				for (const spawn of content.enemies) run.bodies.push(createBody(run.sector, spawn.kind, spawn.position, content.roomId));
				noticeRemote.FireClient(player, "Alarme do depósito acionado!");
			}
		});
	}

	function beginExtraction(run: Run) {
		const { attempt, player } = run;
		if (!livingRoot(player) || !attempt.beginExtraction()) return;
		run.dirty = true;
		const facts: ExtractionFacts = { guardianDefeated: true, guardianRecord: true };
		const [succeeded, credited] = pcall(() => options.onExtracted(player, attempt.id, attempt.lootCopy(), facts));
		if (!succeeded) warn(`[Project Genesis] Extração ${attempt.id} falhou: ${credited}`);
		const done = attempt.resolveExtraction(succeeded && credited === true);
		run.dirty = true;
		if (!done && !attempt.isOver()) noticeRemote.FireClient(player, "A extração não foi confirmada. Tente de novo.");
	}

	function clearRoom(run: Run, room: Room) {
		run.cleared.add(room.id);
		run.dirty = true;
		for (const door of doorsFrom(run, room.id)) run.sector.setDoor(door, true);
		const entrance = doorInto(run, room.id);
		if (entrance) run.sector.setDoor(entrance, true);
		const content = contentOf(run, room.id);
		if (!content) return;
		if (room.kind === "encounter") {
			addCrate(run, content, "Suprimentos");
			const humanoid = run.player.Character?.FindFirstChildOfClass("Humanoid");
			if (humanoid && humanoid.Health > 0) humanoid.Health = math.min(humanoid.MaxHealth, humanoid.Health + CLEAR_HEAL);
		}
		if (!content.offer.isEmpty() && run.attempt.openOffer(room.id, content.offer)) {
			noticeRemote.FireClient(run.player, "Melhoria disponível.");
		}
	}

	function enterRoom(run: Run, room: Room) {
		run.entered.add(room.id);
		run.dirty = true;
		const content = contentOf(run, room.id);
		const point = room.template.points[0];
		const isFight = room.kind === "encounter" || room.kind === "boss";
		if (isFight && content && !content.enemies.isEmpty()) {
			const entrance = doorInto(run, room.id);
			if (entrance) run.sector.setDoor(entrance, false);
			for (const spawn of content.enemies) run.bodies.push(createBody(run.sector, spawn.kind, spawn.position, room.id));
			return;
		}
		if (room.kind === "depot" && content) addCrate(run, content, "Depósito");
		if (room.kind === "upgrade" && point) {
			const at = run.sector.toWorld(roomPoint(room, point), 1.5);
			block(run.sector.dynamic, "Bancada", new Vector3(5, 3, 5), at, CYAN, Enum.Material.Neon);
		}
		if (room.kind === "extraction" && point) {
			const at = run.sector.toWorld(roomPoint(room, point), 0.3);
			const pad = block(run.sector.dynamic, "Elevador", new Vector3(12, 0.6, 12), at, GREEN, Enum.Material.Neon);
			addPrompt(pad, "Extrair", "Elevador de carga", 1.2, (player) => {
				if (player === run.player) beginExtraction(run);
			});
		}
		clearRoom(run, room);
	}

	/** Encerra uma vez: informa o resultado, devolve o jogador e limpa o setor. */
	function closeRun(run: Run) {
		if (run.closing) return;
		run.closing = true;
		runs = runs.filter((other) => other !== run);
		const { attempt, player } = run;
		const secured = attempt.phase === "Extracted" ? attempt.lootCopy() : {};
		const record = attempt.phase === "Extracted" && attempt.guardianDefeated;
		const outcome = attempt.phase === "Extracted" ? "extracted" : (attempt.endReason ?? "failed");
		const last = stateOf(run);
		const lost = attempt.clear();
		const result = { outcome, secured, lost, record } as const;
		task.spawn(() => {
			if (player.Parent === players) {
				stateRemote.FireClient(player, { ...last, upgrades: [], offer: undefined, boss: undefined, result });
				if (livingRoot(player)) {
					pcall(() => player.RequestStreamAroundAsync(options.returnPoint.Position, 3));
					if (livingRoot(player)) player.Character?.PivotTo(options.returnPoint);
				}
				player.SetAttribute(IN_ENCOUNTER, undefined);
				player.SetAttribute(SPEED_SCALE, undefined);
			}
			run.sector.folder.Destroy();
			options.onEnded?.(player, outcome);
		});
	}

	function hasSight(run: Run, from: Flat, to: Flat): boolean {
		const params = new RaycastParams();
		params.FilterType = Enum.RaycastFilterType.Include;
		params.FilterDescendantsInstances = [run.sector.geometry];
		const start = run.sector.toWorld(from, EYE_HEIGHT);
		return workspace.Raycast(start, run.sector.toWorld(to, EYE_HEIGHT).sub(start), params) === undefined;
	}

	function attackEnemies(run: Run, origin: Flat, aim: Flat, id: PlayerAttackId, now: number) {
		const attack: AttackType = PLAYER_ATTACKS[id];
		for (const body of run.bodies) {
			const { enemy } = body;
			if (enemy.state === "Dead" || !isInsideAttack(attack, origin, aim, enemy.position)) continue;
			if (attack.needsSight && !hasSight(run, origin, enemy.position)) continue;
			const amount = enemy.damage(run.fighter.damage(id), now);
			const killed = enemy.health <= 0;
			body.bar.Size = UDim2.fromScale(enemy.health / enemy.kind.health, 1);
			fxRemote.FireClient(run.player, {
				kind: "hit",
				position: run.sector.toWorld(enemy.position, body.hover),
				amount,
				killed,
				target: body.model,
			});
			run.dirty = true;
			if (!killed) continue;
			const { model } = body;
			task.delay(0.35, () => model.Destroy());
			if (enemy.kind.id === "guardian") run.attempt.bossDown(now);
		}
	}

	function strikePlayer(run: Run, swing: Swing, now: number) {
		const root = livingRoot(run.player);
		if (!root || run.attempt.phase !== "Active" || run.fighter.isInvulnerable(now)) return;
		const position = run.sector.toFlat(root.Position);
		if (!isInsideAttack(swing.attack, swing.origin, swing.aim, position)) return;
		if (swing.attack.needsSight && !hasSight(run, swing.origin, position)) return;
		const through = run.fighter.absorb(swing.attack.damage);
		if (through > 0) run.player.Character?.FindFirstChildOfClass("Humanoid")?.TakeDamage(through);
		fxRemote.FireClient(run.player, { kind: "hurt", amount: swing.attack.damage, shielded: through <= 0 });
		syncRemote.FireClient(run.player, run.fighter.state(now));
	}

	function updateEnemy(run: Run, body: Body, now: number) {
		const enemy: Enemy = body.enemy;
		const root = run.attempt.phase === "Active" ? livingRoot(run.player) : undefined;
		const position = root && run.sector.toFlat(root.Position);
		const perception = position && { position, visible: hasSight(run, enemy.position, position) };
		const event = enemy.update(now, perception);
		if (event && event.kind === "telegraph") showTelegraph(run.sector, event.swing);
		else if (event) strikePlayer(run, event.swing, now);
		moveEnemy(enemy, STEP, (from, to) => hasSight(run, from, to));
		placeBody(run.sector, body);
	}

	function trackPlayer(run: Run, now: number) {
		const root = livingRoot(run.player);
		if (!root) {
			run.attempt.finish("died");
			return;
		}
		if (now < run.enteredAt + ENTRY_GRACE) return;
		if (root.Position.Y < ORIGIN.Y - 20) {
			// Queda sob o piso é falha do cenário: volta ao centro da última sala.
			run.player.Character?.PivotTo(new CFrame(run.sector.toWorld(run.room, 5)));
			run.enteredAt = now;
			return;
		}
		const position = run.sector.toFlat(root.Position);
		const rooms = run.expedition.layout.rooms;
		const inside = rooms.find((room) => isInsideRoom(room, position));
		if (!inside) {
			const far = rooms.every((room) => flatDistance(room, position) > 200);
			if (far) run.attempt.finish("left");
			return;
		}
		if (inside !== run.room) {
			run.room = inside;
			run.dirty = true;
		}
		if (!run.entered.has(inside.id) && isInsideRoom(inside, position, ENTER_MARGIN)) enterRoom(run, inside);
	}

	function stepRun(run: Run, now: number) {
		if (run.attempt.isOver()) return closeRun(run);
		if (run.attempt.phase === "Preparing") return;
		trackPlayer(run, now);
		if (run.attempt.isOver()) return closeRun(run);
		for (const body of run.bodies) {
			if (body.enemy.state !== "Dead") updateEnemy(run, body, now);
		}
		for (const room of run.expedition.layout.rooms) {
			if (room.kind !== "encounter" || !run.entered.has(room.id) || run.cleared.has(room.id)) continue;
			if (aliveIn(run, room.id) === 0) clearRoom(run, room);
		}
		if (run.attempt.settleBoss(now)) {
			collect(run, { ancient_fragment: 1 });
			const bossRoom = run.expedition.layout.rooms.find((room) => room.kind === "boss");
			if (bossRoom) clearRoom(run, bossRoom);
			noticeRemote.FireClient(run.player, "Guardião derrotado. Extração liberada.");
		}
		if (run.dirty && now >= run.pushedAt + PUSH_SECONDS) {
			run.dirty = false;
			run.pushedAt = now;
			stateRemote.FireClient(run.player, stateOf(run));
		}
	}

	function freeSlot(): number {
		let slot = 0;
		while (runs.some((run) => run.slot === slot)) slot += 1;
		return slot;
	}

	function enter(player: Player) {
		if (!livingRoot(player) || runOf(player) || preparing.has(player.UserId) || !options.canEnter(player)) return;
		const seed = new Random().NextInteger(1, MAX_SEED);
		const { expedition, problems, attempts } = generate(seed);
		if (!expedition) {
			// O jogador ainda está na base: nada foi retirado dele.
			warn(`[Project Genesis] Expedição recusada, seed ${seed}: ${problems.join(" | ")}`);
			noticeRemote.FireClient(player, "O setor está indisponível agora.");
			return;
		}
		const attempt = new Attempt(http.GenerateGUID(false));
		print(`[Project Genesis] Expedição ${attempt.id}: seed ${seed}, gerador ${expedition.generatorVersion}, descartes ${attempts}.`);
		if (expedition.usedFallback) warn(`[Project Genesis] Mapa de contingência usado na seed ${seed}.`);

		preparing.add(player.UserId);
		const slot = freeSlot();
		const sector = buildSector(expedition.layout, ORIGIN.add(new Vector3(slot * SLOT_SPACING, 0, 0)), container);
		const first = expedition.layout.rooms[0];
		const run: Run = {
			player,
			slot,
			attempt,
			fighter: new Fighter(),
			expedition,
			sector,
			bodies: [],
			entered: new Set(),
			cleared: new Set(),
			opened: new Set(),
			enteredAt: os.clock(),
			room: first,
			dirty: true,
			pushedAt: 0,
			closing: false,
		};
		runs.push(run);
		const arrival = sector.toWorld(roomPoint(first, first.template.points[0]), 4);
		const [streamed, problem] = pcall(() => player.RequestStreamAroundAsync(arrival, 5));
		if (!streamed) warn(`[Project Genesis] Streaming do setor falhou: ${problem}`);
		preparing.delete(player.UserId);
		// O jogador pode ter saído ou morrido durante a espera.
		if (!livingRoot(player) || !attempt.activate()) {
			attempt.finish("left");
			return;
		}
		run.enteredAt = os.clock();
		player.SetAttribute(IN_ENCOUNTER, true);
		player.Character?.PivotTo(new CFrame(arrival));
		enterRoom(run, first);
	}

	function choose(run: Run, roomId: number, id: string) {
		if (run.room.id !== roomId) return;
		const upgrade = run.attempt.choose(roomId, id);
		if (!upgrade) return;
		if (upgrade.effect === "speed") {
			const scale = run.player.GetAttribute(SPEED_SCALE);
			run.player.SetAttribute(SPEED_SCALE, (typeIs(scale, "number") ? scale : 1) + upgrade.amount);
		} else {
			run.fighter.upgrade(upgrade.effect, upgrade.amount);
		}
		syncRemote.FireClient(run.player, run.fighter.state(os.clock()));
		run.dirty = true;
	}

	combatRemote.OnServerEvent.Connect((player, payload) => {
		if (!takeToken(getSession(player))) return;
		const command = parseCombat(payload);
		const root = livingRoot(player);
		const run = runOf(player);
		if (!command || !root || !run || run.attempt.phase !== "Active") return;
		const now = os.clock();
		const accepted = command.kind === "dodge" ? run.fighter.dodge(now) : run.fighter.attack(command.kind, now);
		if (!accepted) return syncRemote.FireClient(player, run.fighter.state(now));
		if (command.kind !== "dodge") {
			attackEnemies(run, run.sector.toFlat(root.Position), { x: command.x, z: command.z }, command.kind, now);
		}
	});

	commandRemote.OnServerEvent.Connect((player, payload) => {
		if (!takeToken(getSession(player))) return;
		const command = parseExpedition(payload);
		const run = runOf(player);
		if (!command || !run) return;
		if (command.kind === "leave") run.attempt.finish("left");
		else choose(run, command.roomId, command.upgrade);
	});

	players.PlayerRemoving.Connect((player) => {
		runOf(player)?.attempt.finish("left");
		preparing.delete(player.UserId);
	});

	let pending = 0;
	runService.Heartbeat.Connect((delta) => {
		debug.profilebegin("GenesisExpeditions");
		pending = math.min(pending + delta, MAX_DELAY);
		while (pending >= STEP) {
			pending -= STEP;
			const now = os.clock();
			for (const run of [...runs]) stepRun(run, now);
		}
		debug.profileend();
	});

	addPrompt(options.entrance, "Entrar", "Setor de manutenção", 0.6, enter);

	return { isActive: (player: Player) => runOf(player) !== undefined };
}
