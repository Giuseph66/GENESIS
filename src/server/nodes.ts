import { ItemId } from "../shared/catalog";
import { NODE_DEPLETED, NODE_ID, NODE_ITEM, NODE_REACH, NODE_TAG } from "../shared/nodes";
import type { Reason } from "../shared/protocol";
import type { Inventory } from "./inventory";
import { Mining, NodeType } from "./mining";

const collection = game.GetService("CollectionService");

/** Folga para o deslocamento do jogador durante a latência. */
const REACH_TOLERANCE = 5;

const mining = new Mining();
const instances = new Map<string, PVInstance>();

function parts(target: PVInstance): Array<BasePart> {
	const list = new Array<BasePart>();
	if (target.IsA("BasePart")) list.push(target);
	for (const child of target.GetDescendants()) {
		if (child.IsA("BasePart")) list.push(child);
	}
	return list;
}

function showDepleted(id: string, depleted: boolean) {
	const target = instances.get(id);
	if (!target) return;
	target.SetAttribute(NODE_DEPLETED, depleted);
	for (const part of parts(target)) {
		part.Transparency = depleted ? 1 : 0;
		part.CanCollide = !depleted;
	}
}

function scheduleRespawn(id: string, seconds: number) {
	task.delay(seconds + 0.1, () => {
		if (!mining.isDepleted(id, os.clock())) showDepleted(id, false);
	});
}

export function addNode(target: PVInstance, id: string, kind: NodeType) {
	mining.define(id, kind);
	instances.set(id, target);
	target.SetAttribute(NODE_ID, id);
	target.SetAttribute(NODE_ITEM, kind.item);
	target.SetAttribute(NODE_DEPLETED, false);
	if (mining.isDepleted(id, os.clock())) {
		showDepleted(id, true);
		scheduleRespawn(id, kind.respawnSeconds);
	}
	collection.AddTag(target, NODE_TAG);
}

export function removeNode(id: string) {
	mining.undefine(id);
	instances.delete(id);
}

const RESPAWN_SECONDS = 120;

export const WILD_NODES: { readonly [id in "iron_ore" | "coal"]: NodeType } = {
	iron_ore: { item: "iron_ore" as ItemId, amount: 3, hits: 6, respawnSeconds: RESPAWN_SECONDS },
	coal: { item: "coal" as ItemId, amount: 1, hits: 6, respawnSeconds: RESPAWN_SECONDS },
};

/** Golpe de um jogador. A identidade e a posição vêm do servidor. */
export function hitNode(userId: number, position: Vector3, inventory: Inventory, id: string): Reason {
	const target = instances.get(id);
	if (!target) return "NOT_FOUND";
	if (target.GetPivot().Position.sub(position).Magnitude > NODE_REACH + REACH_TOLERANCE) return "TOO_FAR";
	const result = mining.hit(id, userId, inventory, os.clock());
	if (result.reason === "OK" && result.depleted) {
		showDepleted(id, true);
		scheduleRespawn(id, RESPAWN_SECONDS);
	}
	return result.reason;
}
