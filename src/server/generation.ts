import type { Counts, ItemId } from "../shared/catalog";
import type { EnemyId, Flat } from "../shared/combat";
import { OFFER_SIZE, RARITY_WEIGHT, UPGRADES, UpgradeType } from "../shared/expedition";
import { RoomKind, RoomTemplate, Socket, TEMPLATES } from "./expedition-templates";

export const GENERATOR_VERSION = 1;
export const MAX_CANDIDATES = 8;

const MODULUS = 2147483647;
const MULTIPLIER = 48271;

/** Gerador de Park-Miller. Cabe em números de ponto flutuante e repete igual em qualquer ambiente. */
export class Stream {
	private state: number;

	/** Cada finalidade tem o próprio fluxo: mudar o saque não muda as salas. */
	constructor(seed: number, purpose: number, index = 0) {
		const mixed = (math.abs(math.floor(seed)) % MODULUS) + purpose * 104729 + index * 1299709;
		this.state = (mixed % (MODULUS - 1)) + 1;
		for (let i = 0; i < 8; i++) this.next();
	}

	/** Número em [0, 1). */
	public next(): number {
		this.state = (this.state * MULTIPLIER) % MODULUS;
		return (this.state - 1) / (MODULUS - 1);
	}

	/** Inteiro entre os limites, inclusive. */
	public integer(min: number, max: number): number {
		return min + math.floor(this.next() * (max - min + 1));
	}

	public shuffle<T extends defined>(values: ReadonlyArray<T>): Array<T> {
		const result = [...values];
		for (let i = result.size() - 1; i > 0; i--) {
			const j = this.integer(0, i);
			const kept = result[i];
			result[i] = result[j];
			result[j] = kept;
		}
		return result;
	}
}

const PURPOSE = { layout: 1, enemies: 2, loot: 3, upgrades: 4 };

export interface Room {
	readonly id: number;
	readonly kind: RoomKind;
	readonly template: RoomTemplate;
	readonly x: number;
	readonly z: number;
	readonly rotation: number;
	/** Oferece melhoria depois de limpa. */
	readonly offersUpgrade: boolean;
}

export interface Door {
	readonly from: number;
	readonly to: number;
	readonly x: number;
	readonly z: number;
	/** Lado de saída da sala `from`. */
	readonly side: number;
	readonly width: number;
}

export interface Layout {
	readonly rooms: ReadonlyArray<Room>;
	readonly doors: ReadonlyArray<Door>;
}

export interface EnemySpawn {
	readonly kind: EnemyId;
	readonly position: Flat;
}

export interface RoomContent {
	readonly roomId: number;
	readonly enemies: ReadonlyArray<EnemySpawn>;
	/** Materiais do depósito ou do encontro vencido. */
	readonly loot: Counts;
	readonly lootPoint?: Flat;
	/** Abrir o depósito chama os inimigos desta sala. */
	readonly ambush: boolean;
	readonly offer: ReadonlyArray<string>;
}

export interface Expedition {
	readonly seed: number;
	readonly generatorVersion: number;
	readonly layout: Layout;
	readonly contents: ReadonlyArray<RoomContent>;
	/** Candidatos descartados antes do aceito. */
	readonly attempts: number;
	readonly usedFallback: boolean;
}

export interface GenerationOptions {
	readonly templates?: ReadonlyArray<RoomTemplate>;
	readonly fallback?: () => Layout | undefined;
}

export interface GenerationResult {
	readonly expedition?: Expedition;
	readonly attempts: number;
	readonly problems: ReadonlyArray<string>;
}

export function rotatePoint(point: Flat, rotation: number): Flat {
	let { x, z } = point;
	for (let i = 0; i < rotation; i++) {
		const turned = -z;
		z = x;
		x = turned;
	}
	return { x, z };
}

export function roomPoint(room: Room, point: Flat): Flat {
	const turned = rotatePoint(point, room.rotation);
	return { x: room.x + turned.x, z: room.z + turned.z };
}

export function roomHalfSize(room: Room): Flat {
	const turned = room.rotation % 2 === 1;
	return {
		x: (turned ? room.template.depth : room.template.width) / 2,
		z: (turned ? room.template.width : room.template.depth) / 2,
	};
}

export function isInsideRoom(room: Room, point: Flat, margin = 0): boolean {
	const half = roomHalfSize(room);
	return math.abs(point.x - room.x) <= half.x - margin && math.abs(point.z - room.z) <= half.z - margin;
}

function socketPoint(template: RoomTemplate, socket: Socket): Flat {
	if (socket.side === 0) return { x: socket.offset, z: -template.depth / 2 };
	if (socket.side === 1) return { x: template.width / 2, z: socket.offset };
	if (socket.side === 2) return { x: socket.offset, z: template.depth / 2 };
	return { x: -template.width / 2, z: socket.offset };
}

function overlaps(a: Room, b: Room): boolean {
	const halfA = roomHalfSize(a);
	const halfB = roomHalfSize(b);
	const slack = 0.01;
	return math.abs(a.x - b.x) < halfA.x + halfB.x - slack && math.abs(a.z - b.z) < halfA.z + halfB.z - slack;
}

interface Plan {
	readonly kind: RoomKind;
	readonly offersUpgrade: boolean;
}

/** Caminho principal. Entre as variações, a melhoria vem sempre antes do chefe. */
function planMainPath(stream: Stream): Array<Plan> {
	const entry: Plan = { kind: "entry", offersUpgrade: false };
	const fight: Plan = { kind: "encounter", offersUpgrade: false };
	const bay: Plan = { kind: "upgrade", offersUpgrade: true };
	const finish: Array<Plan> = [
		{ kind: "boss", offersUpgrade: false },
		{ kind: "extraction", offersUpgrade: false },
	];
	const variant = stream.integer(1, 3);
	if (variant === 1) return [entry, fight, fight, bay, ...finish];
	if (variant === 2) return [entry, fight, bay, fight, ...finish];
	return [entry, fight, { kind: "encounter", offersUpgrade: true }, ...finish];
}

/** Monta as salas em ordem estável, ou devolve `undefined` se algo não encaixar. */
class LayoutBuilder {
	public readonly rooms = new Array<Room>();
	public readonly doors = new Array<Door>();
	private readonly usedSides = new Set<string>();

	constructor(
		private readonly templates: ReadonlyArray<RoomTemplate>,
		private readonly stream: Stream,
	) {}

	public start(plan: Plan): boolean {
		const template = this.stream.shuffle(this.templates.filter((candidate) => candidate.kind === plan.kind))[0];
		if (!template) return false;
		this.rooms.push({ id: 1, kind: plan.kind, template, x: 0, z: 0, rotation: 0, offersUpgrade: plan.offersUpgrade });
		return true;
	}

	public attach(from: Room, plan: Plan): Room | undefined {
		const options = this.stream.shuffle(this.templates.filter((candidate) => candidate.kind === plan.kind));
		for (const exit of this.stream.shuffle(from.template.exits)) {
			const sideKey = `${from.id}:${exit.side}:${exit.offset}`;
			if (this.usedSides.has(sideKey)) continue;
			for (const template of options) {
				const entry = template.entry;
				if (!entry || entry.width !== exit.width) continue;
				const at = roomPoint(from, socketPoint(from.template, exit));
				const side = (exit.side + from.rotation) % 4;
				const rotation = (side + 2 - entry.side + 8) % 4;
				const edgePoint = rotatePoint(socketPoint(template, entry), rotation);
				const room: Room = {
					id: this.rooms.size() + 1,
					kind: plan.kind,
					template,
					x: at.x - edgePoint.x,
					z: at.z - edgePoint.z,
					rotation,
					offersUpgrade: plan.offersUpgrade,
				};
				if (this.rooms.some((other) => overlaps(room, other))) continue;
				this.usedSides.add(sideKey);
				this.rooms.push(room);
				this.doors.push({ from: from.id, to: room.id, x: at.x, z: at.z, side, width: exit.width });
				return room;
			}
		}
		return undefined;
	}
}

function buildCandidate(seed: number, index: number, templates: ReadonlyArray<RoomTemplate>): Layout | undefined {
	const stream = new Stream(seed, PURPOSE.layout, index);
	const builder = new LayoutBuilder(templates, stream);
	const path = planMainPath(stream);
	const wantsBranch = stream.next() < 0.75;
	if (!builder.start(path[0])) return undefined;
	let current = builder.rooms[0];
	for (let i = 1; i < path.size(); i++) {
		const room = builder.attach(current, path[i]);
		if (!room) return undefined;
		current = room;
	}
	if (wantsBranch) {
		// A ramificação é opcional: sem espaço, o setor segue válido sem ela.
		for (const host of stream.shuffle(builder.rooms.filter((room) => room.kind === "encounter"))) {
			if (builder.attach(host, { kind: "depot", offersUpgrade: false })) break;
		}
	}
	return { rooms: builder.rooms, doors: builder.doors };
}

/** Mapa fixo de contingência, em linha reta. */
export function fallbackLayout(): Layout | undefined {
	const order = ["entry_dock", "encounter_hall", "encounter_yard", "upgrade_bay", "boss_core", "extraction_lift"];
	const rooms = new Array<Room>();
	const doors = new Array<Door>();
	let edge = 0;
	for (const id of order) {
		const template = TEMPLATES.find((candidate) => candidate.id === id);
		if (!template) return undefined;
		const index = rooms.size();
		if (index === 0) edge = template.depth / 2;
		const z = edge - template.depth / 2;
		if (index > 0) doors.push({ from: index, to: index + 1, x: 0, z: edge, side: 0, width: 14 });
		rooms.push({ id: index + 1, kind: template.kind, template, x: 0, z, rotation: 0, offersUpgrade: template.kind === "upgrade" });
		edge -= template.depth;
	}
	return { rooms, doors };
}

function reachable(layout: Layout, blockedKind?: RoomKind): Set<number> {
	const seen = new Set<number>([layout.rooms[0].id]);
	const queue = [layout.rooms[0].id];
	let cursor = 0;
	while (cursor < queue.size()) {
		const id = queue[cursor];
		cursor += 1;
		if (layout.rooms.find((room) => room.id === id)?.kind === blockedKind) continue;
		for (const door of layout.doors) {
			const neighbor = door.from === id ? door.to : door.to === id ? door.from : undefined;
			if (neighbor === undefined || seen.has(neighbor)) continue;
			seen.add(neighbor);
			queue.push(neighbor);
		}
	}
	return seen;
}

/** Raio usado na passagem: cobre o personagem e o Guardião com folga. */
const BODY_RADIUS = 3;
const NAV_STEP = 2;

function isBlocked(template: RoomTemplate, point: Flat, radius: number): boolean {
	if (math.abs(point.x) > template.width / 2 - radius - 2) return true;
	if (math.abs(point.z) > template.depth / 2 - radius - 2) return true;
	return template.covers.some(
		(item) => math.abs(point.x - item.x) < item.width / 2 + radius && math.abs(point.z - item.z) < item.depth / 2 + radius,
	);
}

/** Todos os encaixes usados e pontos úteis do módulo se alcançam a pé. */
function isNavigable(room: Room, doors: ReadonlyArray<Flat>): boolean {
	const template = room.template;
	const back = (4 - room.rotation) % 4;
	const targets = new Array<Flat>();
	for (const door of doors) {
		const point = rotatePoint({ x: door.x - room.x, z: door.z - room.z }, back);
		// Um passo para dentro da sala, a partir da borda.
		const inset = BODY_RADIUS + 3;
		targets.push({
			x: math.clamp(point.x, -template.width / 2 + inset, template.width / 2 - inset),
			z: math.clamp(point.z, -template.depth / 2 + inset, template.depth / 2 - inset),
		});
	}
	for (const point of template.points) targets.push(point);
	for (const point of template.spawns) targets.push(point);
	if (targets.isEmpty()) return true;
	const key = (x: number, z: number) => `${x},${z}`;
	const snap = (value: number) => math.round(value / NAV_STEP);
	const seen = new Set<string>();
	const queue = [{ x: snap(targets[0].x), z: snap(targets[0].z) }];
	seen.add(key(queue[0].x, queue[0].z));
	let cursor = 0;
	while (cursor < queue.size()) {
		const cell = queue[cursor];
		cursor += 1;
		for (const [dx, dz] of [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
		]) {
			const x = cell.x + dx;
			const z = cell.z + dz;
			if (seen.has(key(x, z)) || isBlocked(template, { x: x * NAV_STEP, z: z * NAV_STEP }, BODY_RADIUS)) continue;
			seen.add(key(x, z));
			queue.push({ x, z });
		}
	}
	return targets.every((target) => seen.has(key(snap(target.x), snap(target.z))));
}

/** Lista o que torna o layout inválido. Vazia quando pode ser entregue. */
export function validateLayout(layout: Layout): Array<string> {
	const problems = new Array<string>();
	const { rooms, doors } = layout;
	if (rooms.size() < 5 || rooms.size() > 7) problems.push(`quantidade de salas: ${rooms.size()}`);
	const ofKind = (kind: RoomKind) => rooms.filter((room) => room.kind === kind);
	if (rooms.isEmpty() || rooms[0].kind !== "entry" || ofKind("entry").size() !== 1) return ["entrada ausente"];
	if (!rooms[0].template.spawns.isEmpty()) problems.push("entrada insegura");
	if (ofKind("boss").size() !== 1) problems.push("chefe ausente");
	if (ofKind("extraction").size() !== 1) problems.push("extração ausente");
	if (ofKind("encounter").size() !== 2) problems.push("encontros ausentes");
	for (let i = 0; i < rooms.size(); i++) {
		for (let j = i + 1; j < rooms.size(); j++) {
			if (overlaps(rooms[i], rooms[j])) problems.push(`salas ${rooms[i].id} e ${rooms[j].id} sobrepostas`);
		}
	}
	for (const door of doors) {
		for (const id of [door.from, door.to]) {
			const room = rooms.find((candidate) => candidate.id === id);
			if (!room) {
				problems.push(`porta para sala ${id} inexistente`);
				continue;
			}
			const sockets = room.template.entry ? [room.template.entry, ...room.template.exits] : room.template.exits;
			const expected = id === door.from ? door.side : (door.side + 2) % 4;
			const aligned = sockets.some((socket) => {
				const point = roomPoint(room, socketPoint(room.template, socket));
				const sameSide = (socket.side + room.rotation) % 4 === expected;
				return sameSide && socket.width === door.width && math.abs(point.x - door.x) < 0.01 && math.abs(point.z - door.z) < 0.01;
			});
			if (!aligned) problems.push(`porta ${door.from}-${door.to} desalinhada na sala ${id}`);
		}
	}
	const all = reachable(layout);
	if (rooms.some((room) => !all.has(room.id))) problems.push("sala inalcançável");
	const withoutBoss = reachable(layout, "boss");
	if (ofKind("extraction").some((room) => withoutBoss.has(room.id))) problems.push("extração sem passar pelo chefe");
	if (!rooms.some((room) => room.offersUpgrade && withoutBoss.has(room.id))) problems.push("sem melhoria antes do chefe");

	for (const room of rooms) {
		const roomDoors = doors.filter((door) => door.from === room.id || door.to === room.id);
		for (const spawn of room.template.spawns) {
			if (isBlocked(room.template, spawn, BODY_RADIUS)) problems.push(`spawn bloqueado em ${room.template.id}`);
			const world = roomPoint(room, spawn);
			const near = roomDoors.some((door) => math.abs(door.x - world.x) < 10 && math.abs(door.z - world.z) < 10);
			if (near) problems.push(`spawn junto à porta em ${room.template.id}`);
		}
		if (!isNavigable(room, roomDoors)) problems.push(`sala ${room.template.id} sem passagem`);
	}
	return problems;
}

function pickUpgrade(stream: Stream, options: ReadonlyArray<UpgradeType>): UpgradeType {
	let totalWeight = 0;
	for (const option of options) totalWeight += RARITY_WEIGHT[option.rarity];
	let roll = stream.next() * totalWeight;
	for (const option of options) {
		roll -= RARITY_WEIGHT[option.rarity];
		if (roll < 0) return option;
	}
	return options[options.size() - 1];
}

/** Três opções de efeitos diferentes. */
function rollOffer(stream: Stream): Array<string> {
	const offer = new Array<string>();
	let options: ReadonlyArray<UpgradeType> = UPGRADES;
	while (offer.size() < OFFER_SIZE && !options.isEmpty()) {
		const chosen = pickUpgrade(stream, options);
		offer.push(chosen.id);
		options = options.filter((option) => option.effect !== chosen.effect);
	}
	return offer;
}

function rollLoot(stream: Stream, kind: RoomKind): Counts {
	const loot: Counts = {};
	const give = (item: ItemId, min: number, max: number) => {
		const amount = stream.integer(min, max);
		if (amount > 0) loot[item] = amount;
	};
	if (kind === "encounter") {
		give("iron_ore", 2, 5);
		give("coal", 0, 2);
	} else if (kind === "depot") {
		give("iron_bar", 4, 8);
		give("coal", 2, 4);
		give("component", 0, 2);
	}
	return loot;
}

/** Preenche salas já validadas, com um fluxo por finalidade. */
export function populate(layout: Layout, seed: number): Array<RoomContent> {
	let encounters = 0;
	return layout.rooms.map((room) => {
		const enemyStream = new Stream(seed, PURPOSE.enemies, room.id);
		const lootStream = new Stream(seed, PURPOSE.loot, room.id);
		const enemies = new Array<EnemySpawn>();
		let ambush = false;
		const spawns = enemyStream.shuffle(room.template.spawns);
		if (room.kind === "boss") {
			enemies.push({ kind: "guardian", position: roomPoint(room, room.template.spawns[0]) });
		} else if (room.kind === "encounter") {
			encounters += 1;
			const amount = math.min(spawns.size(), encounters + enemyStream.integer(1, 2));
			for (let i = 0; i < amount; i++) {
				const kind: EnemyId = i === 0 ? "drone" : i === 1 ? "robot" : enemyStream.next() < 0.5 ? "drone" : "robot";
				enemies.push({ kind, position: roomPoint(room, spawns[i]) });
			}
		} else if (room.kind === "depot") {
			ambush = enemyStream.next() < 0.5;
			if (ambush) for (const spawn of spawns) enemies.push({ kind: "drone", position: roomPoint(room, spawn) });
		}
		const hasLoot = room.kind === "encounter" || room.kind === "depot";
		return {
			roomId: room.id,
			enemies,
			loot: rollLoot(lootStream, room.kind),
			lootPoint: hasLoot ? roomPoint(room, room.template.points[0]) : undefined,
			ambush,
			offer: room.offersUpgrade ? rollOffer(new Stream(seed, PURPOSE.upgrades, room.id)) : [],
		};
	});
}

/** Até oito candidatos, depois a contingência. Sem mapa válido, não há expedição. */
export function generate(seed: number, options: GenerationOptions = {}): GenerationResult {
	const templates = options.templates ?? TEMPLATES;
	const problems = new Array<string>();
	const deliver = (layout: Layout, attempts: number, usedFallback: boolean): GenerationResult => ({
		expedition: {
			seed,
			generatorVersion: GENERATOR_VERSION,
			layout,
			contents: populate(layout, seed),
			attempts,
			usedFallback,
		},
		attempts,
		problems,
	});
	for (let index = 0; index < MAX_CANDIDATES; index++) {
		const layout = buildCandidate(seed, index, templates);
		const found = layout ? validateLayout(layout) : ["encaixe sem espaço"];
		if (layout && found.isEmpty()) return deliver(layout, index, false);
		problems.push(`candidato ${index + 1}: ${found.join("; ")}`);
	}
	const fallback = (options.fallback ?? fallbackLayout)();
	const found = fallback ? validateLayout(fallback) : ["mapa ausente"];
	if (fallback && found.isEmpty()) return deliver(fallback, MAX_CANDIDATES, true);
	problems.push(`contingência: ${found.join("; ")}`);
	return { attempts: MAX_CANDIDATES, problems };
}
