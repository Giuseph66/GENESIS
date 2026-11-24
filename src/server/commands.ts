import { findItem, findMachine, INVENTORY_CAPACITY } from "../shared/catalog";
import { GRANTS } from "../shared/party";
import type { Action, Command } from "../shared/protocol";

const MAX_ID = 2 ** 31;
const MAX_CELL = 1000;
const MAX_NODE_ID = 40;
const MAX_USER_ID = 2 ** 52;

type Raw = { readonly [key: string]: unknown };

function integer(value: unknown, min: number, max: number): number | undefined {
	if (!typeIs(value, "number") || value !== value || math.floor(value) !== value) return undefined;
	return value >= min && value <= max ? value : undefined;
}

function parsePlacement(raw: Raw): { cx: number; cz: number; rotation: number } | undefined {
	const cx = integer(raw.cx, -MAX_CELL, MAX_CELL);
	const cz = integer(raw.cz, -MAX_CELL, MAX_CELL);
	const rotation = integer(raw.rotation, 0, 3);
	if (cx === undefined || cz === undefined || rotation === undefined) return undefined;
	return { cx, cz, rotation };
}

function parseAction(raw: Raw): Action | undefined {
	if (raw.kind === "build") {
		const machine = findMachine(raw.machine);
		const placement = parsePlacement(raw);
		return machine && placement && { kind: "build", machine: machine.id, ...placement };
	}

	if (raw.kind === "mine") {
		const { nodeId } = raw;
		return typeIs(nodeId, "string") && nodeId.size() <= MAX_NODE_ID ? { kind: "mine", nodeId } : undefined;
	}

	if (raw.kind === "answer") {
		return typeIs(raw.accept, "boolean") ? { kind: "answer", accept: raw.accept } : undefined;
	}
	if (raw.kind === "invite" || raw.kind === "grant" || raw.kind === "expel") {
		// Jogadores de teste do Studio usam IDs negativos.
		const userId = integer(raw.userId, -MAX_USER_ID, MAX_USER_ID);
		if (userId === undefined) return undefined;
		if (raw.kind !== "grant") return { kind: raw.kind, userId };
		const grant = GRANTS.find((candidate) => candidate.id === raw.grant);
		return grant && typeIs(raw.enabled, "boolean") ? { kind: "grant", userId, grant: grant.id, enabled: raw.enabled } : undefined;
	}

	const structureId = integer(raw.structureId, 1, MAX_ID);
	if (structureId === undefined) return undefined;
	if (raw.kind === "move") {
		const placement = parsePlacement(raw);
		return placement && { kind: "move", structureId, ...placement };
	}
	if (raw.kind === "remove") return { kind: "remove", structureId };
	if (raw.kind === "restore") return { kind: "restore", structureId };
	if (raw.kind === "extract") return { kind: "extract", structureId };
	if (raw.kind === "toggle") {
		return typeIs(raw.enabled, "boolean") ? { kind: "toggle", structureId, enabled: raw.enabled } : undefined;
	}
	if (raw.kind === "insert") {
		const item = findItem(raw.item);
		const amount = integer(raw.amount, 1, INVENTORY_CAPACITY);
		return item && amount !== undefined ? { kind: "insert", structureId, item: item.id, amount } : undefined;
	}
	return undefined;
}

/** Aceita somente os campos previstos. Todo o resto é recusado. */
export function parseCommand(payload: unknown): Command | undefined {
	if (!typeIs(payload, "table")) return undefined;
	const raw = payload as Raw;
	if (raw.kind === "sync") return { kind: "sync" };
	if (raw.kind !== "act" || !typeIs(raw.action, "table")) return undefined;
	const requestId = integer(raw.requestId, 1, MAX_ID);
	const action = parseAction(raw.action as Raw);
	return requestId !== undefined && action ? { kind: "act", requestId, action } : undefined;
}
