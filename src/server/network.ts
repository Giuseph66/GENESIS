import { BUILD_REACH } from "../shared/grid";
import { INVITE_SECONDS, PartyEntry } from "../shared/party";
import {
	Action,
	COMMAND_REMOTE,
	CommandResult,
	PartyAction,
	Reason,
	REMOTES_FOLDER,
	RESULT_REMOTE,
	STATE_REMOTE,
} from "../shared/protocol";
import { parseCommand } from "./commands";
import type { Actor, Facility } from "./facility";
import { hitNode } from "./nodes";
import { getSession, PartyState, Progress, Session, takeToken, worldProgress } from "./session";

const http = game.GetService("HttpService");
const players = game.GetService("Players");
const replicatedStorage = game.GetService("ReplicatedStorage");

const REMEMBERED_RESULTS = 64;

export function livingRoot(player: Player): BasePart | undefined {
	const humanoid = player.Character?.FindFirstChildOfClass("Humanoid");
	const root = player.Character?.FindFirstChild("HumanoidRootPart");
	return humanoid && humanoid.Health > 0 && root?.IsA("BasePart") ? root : undefined;
}

function actorFor(player: Player, session: Session): Actor {
	return {
		userId: player.UserId,
		inventory: session.inventory,
		isNear: (point) => {
			const root = livingRoot(player);
			return root !== undefined && root.Position.sub(point).Magnitude <= BUILD_REACH;
		},
	};
}

/** `isWritable` é falso enquanto o mundo não pode ser gravado com segurança. */
export function createNetwork(facility: Facility, isWritable: () => boolean, onChanged: () => void) {
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

	const { permissions } = facility;
	const isMember = (userId: string) => permissions.role(tonumber(userId) ?? 0) !== "visitor";

	function progress(): Progress {
		return worldProgress(isMember);
	}

	function nameOf(userId: number): string {
		return players.GetPlayerByUserId(userId)?.DisplayName ?? `Jogador ${userId}`;
	}

	function entryOf(userId: number): PartyEntry {
		return {
			userId,
			name: nameOf(userId),
			role: permissions.role(userId),
			online: players.GetPlayerByUserId(userId) !== undefined,
			invited: permissions.isInvited(userId, os.clock()),
			grants: permissions.grants(userId),
		};
	}

	/** Todos veem quem está no grupo. Só o proprietário vê visitantes para convidar. */
	function partyOf(player: Player): PartyState {
		const { ownerId } = permissions;
		const entries = [entryOf(ownerId)];
		for (const userId of permissions.memberIds()) entries.push(entryOf(userId));
		if (player.UserId === ownerId) {
			for (const other of players.GetPlayers()) {
				if (permissions.role(other.UserId) === "visitor") entries.push(entryOf(other.UserId));
			}
		}
		const invited = permissions.isInvited(player.UserId, os.clock());
		return {
			role: permissions.role(player.UserId),
			grants: permissions.grants(player.UserId),
			invitedBy: invited ? nameOf(ownerId) : undefined,
			entries,
		};
	}

	function executeParty(player: Player, action: PartyAction): Reason {
		const by = player.UserId;
		if (action.kind === "answer") return permissions.answer(by, action.accept, os.clock());
		if (action.kind === "grant") return permissions.setGrant(by, action.userId, action.grant, action.enabled);
		if (action.kind === "expel") return permissions.expel(by, action.userId);
		if (!players.GetPlayerByUserId(action.userId)) return "NOT_FOUND";
		const reason = permissions.invite(by, action.userId, os.clock());
		// Ao vencer, o aviso precisa sair da tela de quem não respondeu.
		if (reason === "OK") task.delay(INVITE_SECONDS + 0.5, pushStateToAll);
		return reason;
	}

	function pushState(player: Player) {
		const world = {
			...progress(),
			generatorRestored: facility.generatorRestored(),
			automationDone: facility.factory.automationDone,
			research: facility.research.state(),
		};
		const session = getSession(player);
		session.claimRecovery();
		stateRemote.FireClient(player, session.state(world, partyOf(player)));
	}

	function pushStateToAll() {
		for (const player of players.GetPlayers()) pushState(player);
	}

	function notify(player: Player, reason: Reason) {
		resultRemote.FireClient(player, { requestId: 0, reason });
	}

	function mine(player: Player, session: Session, nodeId: string): Reason {
		const root = livingRoot(player);
		if (!root) return "TOO_FAR";
		if (permissions.role(player.UserId) === "visitor") return "NOT_MEMBER";
		const reason = hitNode(player.UserId, root.Position, session.inventory, nodeId);
		if (reason === "OK") session.recordSupplies();
		return reason;
	}

	function run(player: Player, session: Session, action: Action): Reason {
		if (action.kind === "mine") return mine(player, session, action.nodeId);
		if (action.kind === "invite" || action.kind === "answer" || action.kind === "grant" || action.kind === "expel") {
			return executeParty(player, action);
		}
		return facility.execute(actorFor(player, session), action);
	}

	function execute(player: Player, session: Session, requestId: number, action: Action): CommandResult {
		const signature = http.JSONEncode(action);
		const previous = session.results.get(requestId);
		if (previous) {
			return previous.signature === signature ? previous.result : { requestId, reason: "INVALID_REQUEST" };
		}

		if (!isWritable()) return { requestId, reason: "WORLD_UNAVAILABLE" };
		const reason = run(player, session, action);
		const result: CommandResult = { requestId, reason };
		session.results.set(requestId, { signature, result });
		session.resultOrder.push(requestId);
		if (session.resultOrder.size() > REMEMBERED_RESULTS) {
			const oldest = session.resultOrder.shift();
			if (oldest !== undefined) session.results.delete(oldest);
		}
		if (reason === "OK") onChanged();
		return result;
	}

	commandRemote.OnServerEvent.Connect((player, payload) => {
		const session = getSession(player);
		if (!takeToken(session)) return notify(player, "RATE_LIMITED");
		const command = parseCommand(payload);
		if (!command) return notify(player, "INVALID_REQUEST");
		if (command.kind === "sync") return pushState(player);
		resultRemote.FireClient(player, execute(player, session, command.requestId, command.action));
		pushStateToAll();
	});

	players.PlayerRemoving.Connect((player) => {
		// O cliente recomeça a contagem de requestId ao voltar.
		const session = getSession(player);
		session.results.clear();
		session.resultOrder.clear();
	});

	// Entradas e saídas mudam a lista do grupo para todos.
	players.PlayerAdded.Connect(() => pushStateToAll());
	players.PlayerRemoving.Connect((leaving) => {
		for (const player of players.GetPlayers()) if (player !== leaving) pushState(player);
	});

	folder.Parent = replicatedStorage;
	return { pushState, pushStateToAll, notify, progress, isMember };
}
