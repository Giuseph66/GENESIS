import { BOOTSTRAP_REVISION, PROJECT_NAME } from "../shared/bootstrap";
import { GATHER } from "../shared/catalog";
import { WORLD_STATUS } from "../shared/protocol";
import { FACT_CHAPTER_ONE, FACT_GUARDIAN_DEFEATED, FACT_GUARDIAN_RECORD } from "../shared/research";
import { createExpeditions } from "./expedition";
import { Facility } from "./facility";
import { getInstallation } from "./installation";
import { createNetwork, livingRoot } from "./network";
import { addNode } from "./nodes";
import { createStore } from "./persistence/datastore";
import { openWorld, WorldSession } from "./persistence/session";
import { captureSessions, getSession, loadSessions, sessionOf } from "./session";
import { isValidWorld, WorldSnapshot } from "./snapshot";
import { hideStructure, publishEnergy, publishState, showStructure } from "./structures";
import { startWorld } from "./world";

const PROMPT_DISTANCE = 9;
/** Folga para o deslocamento do jogador durante a latência. */
const DISTANCE_TOLERANCE = 4;
const STORE_NAME = "GenesisWorlds";
const BUSY_RETRY_SECONDS = 15;

const http = game.GetService("HttpService");
const players = game.GetService("Players");
const runService = game.GetService("RunService");
const workspace = game.GetService("Workspace");

function log(message: string) {
	print(`[${PROJECT_NAME}] ${message}`);
}

/** O snapshot compartilha tabelas com a simulação. A gravação precisa de uma cópia. */
function copy<T>(value: T): T {
	return http.JSONDecode(http.JSONEncode(value)) as T;
}

workspace.SetAttribute(WORLD_STATUS, "Carregando o mundo…");
startWorld();

/** Mundo solo: pertence ao primeiro jogador que entra no servidor. */
function waitForOwner(): Player {
	let owner = players.GetPlayers()[0];
	while (!owner) {
		[owner] = players.PlayerAdded.Wait();
	}
	return owner;
}

function open(ownerId: string): WorldSession {
	const choice = createStore(STORE_NAME);
	if (!choice.durable) log(`Progresso apenas em memória: ${choice.problem ?? "DataStore indisponível"}.`);
	const random = new Random();
	while (true) {
		const result = openWorld({
			store: choice.store,
			worldId: ownerId,
			ownerId,
			clock: () => os.time(),
			sleep: (seconds) => task.wait(seconds),
			random: () => random.NextNumber(),
			newToken: () => http.GenerateGUID(false),
			validateWorld: isValidWorld,
		});
		if (result.kind === "ok") return result.world;
		if (result.kind === "unavailable" && result.reason !== "store_error") {
			// Nunca se abre um mundo novo por cima de dados que não puderam ser lidos.
			warn(`[${PROJECT_NAME}] Mundo ${ownerId} indisponível: ${result.reason}.`);
			workspace.SetAttribute(WORLD_STATUS, "Não foi possível ler este mundo. Seus dados foram preservados.");
			while (true) task.wait(60);
		}
		workspace.SetAttribute(
			WORLD_STATUS,
			result.kind === "busy" ? "Este mundo está aberto em outra sessão. Tentando de novo…" : "Sem conexão com o salvamento. Tentando de novo…",
		);
		task.wait(BUSY_RETRY_SECONDS);
	}
}

const owner = waitForOwner();
const world = open(tostring(owner.UserId));
const loaded = world.document();
loadSessions(loaded.members);
const saved = loaded.world as WorldSnapshot | undefined;
const facility = new Facility(owner.UserId, saved && copy(saved), { show: showStructure, hide: hideStructure });
const isMember = (userId: string) => facility.permissions.role(tonumber(userId) ?? 0) !== "visitor";
world.attach({
	capture: () => ({ world: copy(facility.snapshot()), members: captureSessions(isMember) }),
	credit: (userId, items, facts) => sessionOf(userId).credit(items, facts),
});
const isWritable = () => world.state() === "active";

function publish() {
	for (const structure of facility.buildings.all()) {
		const state = facility.factory.state(structure.id);
		if (state) publishState(structure.id, state);
	}
	publishEnergy(facility.factory.energy);
}

const network = createNetwork(facility, isWritable, () => {
	world.markDirty();
	publish();
});
publish();

let researchPush = 0;
let automationKnown = facility.factory.automationDone;
runService.Heartbeat.Connect((delta) => {
	if (!isWritable()) return;
	debug.profilebegin("GenesisFactory");
	if (facility.update(delta) > 0) publish();
	debug.profileend();
	const wasResearching = facility.research.state().active !== undefined;
	const completed = facility.research.update(delta);
	if (completed !== undefined) log(`Pesquisa concluída: ${completed}.`);
	researchPush += delta;
	if (completed !== undefined || (wasResearching && researchPush >= 1)) {
		researchPush = 0;
		network.pushStateToAll();
	}
	if (facility.factory.automationDone && !automationKnown) {
		automationKnown = true;
		network.pushStateToAll();
		log("Primeiro componente entregue pela linha automática.");
	}
});
task.spawn(() => {
	while (world.state() !== "closed") {
		task.wait(1);
		// A fábrica muda sozinha: o checkpoint periódico cobre a simulação.
		world.markDirty();
		const result = world.update();
		if (result === "failed" || result === "lost") warn(`[${PROJECT_NAME}] Salvamento: ${result}.`);
		if (result === "lost") workspace.SetAttribute(WORLD_STATUS, "A sessão deste mundo foi assumida por outro servidor. Reconecte.");
		if (result === "lost") break;
	}
});
game.BindToClose(() => {
	const result = world.close();
	log(`Mundo encerrado: ${result}.`);
});

function bindInteraction(target: BasePart, action: string, object: string, onTriggered: (player: Player) => void) {
	const prompt = new Instance("ProximityPrompt");
	prompt.ActionText = action;
	prompt.ObjectText = object;
	prompt.MaxActivationDistance = PROMPT_DISTANCE;
	prompt.RequiresLineOfSight = false;
	prompt.Triggered.Connect((player) => {
		const root = livingRoot(player);
		if (!root || root.Position.sub(target.Position).Magnitude > PROMPT_DISTANCE + DISTANCE_TOLERANCE) return;
		if (!isWritable()) return network.notify(player, "WORLD_UNAVAILABLE");
		onTriggered(player);
	});
	prompt.Parent = target;
}

const { terminal, iron, coal, maintenanceDoor } = getInstallation();

/** O terminal serve para pesquisar e para encerrar o capítulo. */
bindInteraction(terminal, "Usar", "Terminal de ECHO", (player) => {
	const session = getSession(player);
	const { research, permissions } = facility;
	if (permissions.role(player.UserId) === "visitor") return network.notify(player, "NOT_MEMBER");
	const { facts } = network.progress();
	if (research.isDone("signal_reading") && !facts.includes(FACT_CHAPTER_ONE)) {
		session.facts.add(FACT_CHAPTER_ONE);
		log("Capítulo 1 concluído.");
	} else {
		const reason = facility.startResearch({ inventory: session.inventory }, new Set(facts));
		if (reason !== "OK") return network.notify(player, reason);
	}
	world.markDirty();
	network.pushStateToAll();
});

for (const gather of GATHER) {
	const deposit = gather.item === "coal" ? coal : iron;
	addNode(deposit, `deposit:${gather.item}`, { item: gather.item, amount: gather.amount, hits: 0, respawnSeconds: 0 });
}

createExpeditions({
	entrance: maintenanceDoor,
	returnPoint: new CFrame(0, 4, 17),
	canEnter: (player) => {
		if (!isWritable()) {
			network.notify(player, "WORLD_UNAVAILABLE");
			return false;
		}
		if (facility.permissions.role(player.UserId) === "visitor") {
			network.notify(player, "NOT_MEMBER");
			return false;
		}
		if (facility.research.isDone("maintenance_access")) return true;
		network.notify(player, "SECTOR_LOCKED");
		return false;
	},
	onExtracted: (player, extractionId, loot, facts) => {
		const gained = new Array<string>();
		if (facts.guardianDefeated) gained.push(FACT_GUARDIAN_DEFEATED);
		if (facts.guardianRecord) gained.push(FACT_GUARDIAN_RECORD);
		const result = world.confirmExtraction(extractionId, tostring(player.UserId), loot, gained);
		log(`Extração ${extractionId}: ${result}.`);
		if (result !== "confirmed" && result !== "already") return false;
		if (player.Parent === players) network.pushState(player);
		return true;
	},
});

workspace.SetAttribute(WORLD_STATUS, "");
log(`Servidor inicializado (${BOOTSTRAP_REVISION}).`);
