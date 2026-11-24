import { COST_RESOURCE, findMachine, MachineId } from "../shared/catalog";
import { BUILD_REACH, placementCenter } from "../shared/grid";
import {
	Command,
	COMMAND_REMOTE,
	CommandResult,
	Reason,
	REMOTES_FOLDER,
	RESULT_REMOTE,
	STATE_REMOTE,
} from "../shared/protocol";
import { Buildings } from "./buildings";
import { WorldRepository } from "./repository";
import { getSession, Session } from "./session";
import { hideStructure, showStructure } from "./structures";

const players = game.GetService("Players");
const replicatedStorage = game.GetService("ReplicatedStorage");

const RATE_PER_SECOND = 10;
const RATE_BURST = 10;
const REMEMBERED_RESULTS = 64;
const MAX_ID = 2 ** 31;

function integer(value: unknown, min: number, max: number): number | undefined {
	if (!typeIs(value, "number") || value !== value || math.floor(value) !== value) return undefined;
	return value >= min && value <= max ? value : undefined;
}

/** Aceita somente os campos previstos. Todo o resto é recusado. */
export function parseCommand(payload: unknown): Command | undefined {
	if (!typeIs(payload, "table")) return undefined;
	const raw = payload as { [key: string]: unknown };
	if (raw.kind === "sync") return { kind: "sync" };

	const requestId = integer(raw.requestId, 1, MAX_ID);
	if (requestId === undefined) return undefined;
	if (raw.kind === "build") {
		const machine = findMachine(raw.machine);
		const cx = integer(raw.cx, -1000, 1000);
		const cz = integer(raw.cz, -1000, 1000);
		const rotation = integer(raw.rotation, 0, 3);
		if (!machine || cx === undefined || cz === undefined || rotation === undefined) return undefined;
		return { kind: "build", requestId, machine: machine.id as MachineId, cx, cz, rotation };
	}
	if (raw.kind === "remove") {
		const structureId = integer(raw.structureId, 1, MAX_ID);
		return structureId === undefined ? undefined : { kind: "remove", requestId, structureId };
	}
	return undefined;
}

function takeToken(session: Session): boolean {
	const now = os.clock();
	session.tokens = math.min(RATE_BURST, session.tokens + (now - session.tokensAt) * RATE_PER_SECOND);
	session.tokensAt = now;
	if (session.tokens < 1) return false;
	session.tokens -= 1;
	return true;
}

function livingRoot(player: Player): BasePart | undefined {
	const humanoid = player.Character?.FindFirstChildOfClass("Humanoid");
	const root = player.Character?.FindFirstChild("HumanoidRootPart");
	return humanoid && humanoid.Health > 0 && root?.IsA("BasePart") ? root : undefined;
}

function isNear(player: Player, point: Vector3): boolean {
	const root = livingRoot(player);
	return root !== undefined && root.Position.sub(point).Magnitude <= BUILD_REACH;
}

export function createNetwork(worldId: string, repository: WorldRepository) {
	const saved = repository.load(worldId);
	const buildings = saved ? Buildings.restore(saved) : new Buildings();
	for (const structure of buildings.all()) showStructure(structure);

	const folder = new Instance("Folder");
	folder.Name = REMOTES_FOLDER;
	function remote(name: string): RemoteEvent {
		const event = new Instance("RemoteEvent");
		event.Name = name;
		event.Parent = folder;
		return event;
	}
	const commandRemote = remote(COMMAND_REMOTE);
	const resultRemote = remote(RESULT_REMOTE);
	const stateRemote = remote(STATE_REMOTE);

	function pushState(player: Player) {
		stateRemote.FireClient(player, getSession(player).state(buildings.all().size()));
	}

	function notify(player: Player, reason: Reason) {
		resultRemote.FireClient(player, { requestId: 0, reason });
	}

	function build(player: Player, session: Session, command: Extract<Command, { kind: "build" }>): Reason {
		const machine = findMachine(command.machine);
		if (!machine) return "INVALID_REQUEST";
		if (!session.echoOnline) return "ECHO_OFFLINE";
		const reason = buildings.check(machine, command);
		if (reason !== "OK") return reason;
		if (!isNear(player, placementCenter(machine, command))) return "TOO_FAR";
		// Daqui até o fim não há espera: débito e ocupação mudam juntos.
		if (!session.inventory.remove(COST_RESOURCE, machine.cost)) return "INSUFFICIENT_ITEMS";
		showStructure(buildings.place(machine, command, player.UserId));
		return "OK";
	}

	function remove(player: Player, session: Session, structureId: number): Reason {
		const structure = buildings.get(structureId);
		const machine = structure && findMachine(structure.machine);
		if (!structure || !machine) return "NOT_FOUND";
		if (structure.ownerId !== player.UserId) return "NOT_AUTHORIZED";
		if (!isNear(player, placementCenter(machine, structure))) return "TOO_FAR";
		if (!session.inventory.add(COST_RESOURCE, machine.cost)) return "INVENTORY_FULL";
		buildings.remove(structureId);
		hideStructure(structureId);
		return "OK";
	}

	function execute(player: Player, session: Session, command: Exclude<Command, { kind: "sync" }>): CommandResult {
		const signature =
			command.kind === "build"
				? `build:${command.machine}:${command.cx}:${command.cz}:${command.rotation}`
				: `remove:${command.structureId}`;
		const previous = session.results.get(command.requestId);
		if (previous) {
			return previous.signature === signature
				? previous.result
				: { requestId: command.requestId, reason: "INVALID_REQUEST" };
		}

		const reason = command.kind === "build" ? build(player, session, command) : remove(player, session, command.structureId);
		const result: CommandResult = { requestId: command.requestId, reason };
		session.results.set(command.requestId, { signature, result });
		session.resultOrder.push(command.requestId);
		if (session.resultOrder.size() > REMEMBERED_RESULTS) {
			const oldest = session.resultOrder.shift();
			if (oldest !== undefined) session.results.delete(oldest);
		}
		if (reason === "OK") repository.save(worldId, buildings.snapshot());
		return result;
	}

	commandRemote.OnServerEvent.Connect((player, payload) => {
		const session = getSession(player);
		if (!takeToken(session)) return notify(player, "RATE_LIMITED");
		const command = parseCommand(payload);
		if (!command) return notify(player, "INVALID_REQUEST");
		if (command.kind !== "sync") resultRemote.FireClient(player, execute(player, session, command));
		for (const member of players.GetPlayers()) {
			if (member === player || command.kind !== "sync") pushState(member);
		}
	});

	players.PlayerRemoving.Connect((player) => {
		// O cliente recomeça a contagem de requestId ao voltar.
		const session = getSession(player);
		session.results.clear();
		session.resultOrder.clear();
	});

	folder.Parent = replicatedStorage;
	return { pushState, notify, livingRoot };
}
