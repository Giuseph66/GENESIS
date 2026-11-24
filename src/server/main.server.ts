import { BOOTSTRAP_REVISION, PROJECT_NAME } from "../shared/bootstrap";
import { findResource, ResourceId } from "../shared/catalog";
import { getInstallation } from "./installation";
import { createNetwork } from "./network";
import { MemoryRepository } from "./repository";
import { getSession } from "./session";
import { startWorld } from "./world";

const PROMPT_DISTANCE = 9;
/** Folga para o deslocamento do jogador durante a latência. */
const DISTANCE_TOLERANCE = 4;

const isStudio = game.GetService("RunService").IsStudio();

startWorld();
const network = createNetwork("local", new MemoryRepository());

function bindInteraction(
	target: BasePart,
	action: string,
	object: string,
	holdDuration: number,
	onTriggered: (player: Player) => void,
) {
	const prompt = new Instance("ProximityPrompt");
	prompt.ActionText = action;
	prompt.ObjectText = object;
	prompt.HoldDuration = holdDuration;
	prompt.MaxActivationDistance = PROMPT_DISTANCE;
	prompt.RequiresLineOfSight = false;
	prompt.Triggered.Connect((player) => {
		const root = network.livingRoot(player);
		if (!root || root.Position.sub(target.Position).Magnitude > PROMPT_DISTANCE + DISTANCE_TOLERANCE) return;
		onTriggered(player);
	});
	prompt.Parent = target;
}

function bindDeposit(target: BasePart, id: ResourceId) {
	const resource = findResource(id);
	bindInteraction(target, "Coletar", resource.name, 0.35, (player) => {
		const session = getSession(player);
		if (!session.echoOnline) return network.notify(player, "ECHO_OFFLINE");
		const amount = math.min(resource.gather, session.inventory.space(id));
		if (!session.inventory.add(id, amount)) return network.notify(player, "INVENTORY_FULL");

		session.recordSupplies();
		network.pushState(player);
		if (isStudio) print(`[${PROJECT_NAME}] ${resource.name}: +${amount} (total ${session.inventory.get(id)}).`);
	});
}

const { terminal, iron, coal } = getInstallation();
bindInteraction(terminal, "Ativar", "Terminal de ECHO", 0, (player) => {
	const session = getSession(player);
	if (session.echoOnline) return;

	session.echoOnline = true;
	network.pushState(player);
	if (isStudio) print(`[${PROJECT_NAME}] Terminal de ECHO ativado.`);
});
bindDeposit(iron, "iron_ore");
bindDeposit(coal, "coal");
print(`[${PROJECT_NAME}] Servidor inicializado (${BOOTSTRAP_REVISION}).`);
