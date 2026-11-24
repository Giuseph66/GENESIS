import type { Counts } from "./catalog";

export const EXPEDITION_STATE_REMOTE = "ExpeditionState";
export const EXPEDITION_COMMAND_REMOTE = "ExpeditionCommand";
/** Servidor → cliente: aviso curto durante a tentativa. */
export const EXPEDITION_NOTICE_REMOTE = "ExpeditionNotice";
/** Atributo do jogador com o multiplicador de velocidade da tentativa. Ausente equivale a 1. */
export const SPEED_SCALE = "GenesisSpeedScale";

export type Rarity = "common" | "uncommon" | "rare";
export type Effect = "speed" | "damage" | "shield" | "recharge";

export interface UpgradeType {
	readonly id: string;
	readonly name: string;
	readonly text: string;
	readonly rarity: Rarity;
	readonly effect: Effect;
	/** Fração para velocidade, dano e recarga. Pontos de vida para escudo. */
	readonly amount: number;
}

/** Acúmulos máximos do mesmo efeito na tentativa. */
export const MAX_STACKS = 2;
export const OFFER_SIZE = 3;

export const RARITY_WEIGHT: { readonly [rarity in Rarity]: number } = { common: 6, uncommon: 3, rare: 1 };
export const RARITY_NAME: { readonly [rarity in Rarity]: string } = { common: "Comum", uncommon: "Incomum", rare: "Raro" };

export const UPGRADES: ReadonlyArray<UpgradeType> = [
	{ id: "speed_1", name: "Servo leve", text: "+10% de velocidade", rarity: "common", effect: "speed", amount: 0.1 },
	{ id: "speed_2", name: "Servo calibrado", text: "+18% de velocidade", rarity: "uncommon", effect: "speed", amount: 0.18 },
	{ id: "damage_1", name: "Bobina reforçada", text: "+15% de dano", rarity: "common", effect: "damage", amount: 0.15 },
	{ id: "damage_2", name: "Bobina instável", text: "+25% de dano", rarity: "uncommon", effect: "damage", amount: 0.25 },
	{ id: "damage_3", name: "Núcleo de arco", text: "+40% de dano", rarity: "rare", effect: "damage", amount: 0.4 },
	{ id: "shield_1", name: "Placa defletora", text: "Escudo de 25 pontos", rarity: "common", effect: "shield", amount: 25 },
	{ id: "shield_2", name: "Campo defletor", text: "Escudo de 45 pontos", rarity: "uncommon", effect: "shield", amount: 45 },
	{ id: "recharge_1", name: "Capacitor rápido", text: "Recargas 12% menores", rarity: "common", effect: "recharge", amount: 0.12 },
	{ id: "recharge_2", name: "Capacitor duplo", text: "Recargas 20% menores", rarity: "uncommon", effect: "recharge", amount: 0.2 },
	{ id: "recharge_3", name: "Supercondutor", text: "Recargas 30% menores", rarity: "rare", effect: "recharge", amount: 0.3 },
];

export function findUpgrade(id: unknown): UpgradeType | undefined {
	return UPGRADES.find((upgrade) => upgrade.id === id);
}

/** Preparando → Ativa → ConfirmandoExtração → Extraída, ou EncerradaSemExtração. */
export type AttemptPhase = "Preparing" | "Active" | "Confirming" | "Extracted" | "Ended";
export type EndReason = "died" | "left" | "failed";

/** Fatos narrativos confirmados junto do saque. */
export interface ExtractionFacts {
	readonly guardianDefeated: boolean;
	readonly guardianRecord: boolean;
}

export interface Offer {
	readonly roomId: number;
	readonly options: ReadonlyArray<string>;
}

export interface ExpeditionResult {
	readonly outcome: "extracted" | EndReason;
	readonly secured: Counts;
	readonly lost: Counts;
	readonly record: boolean;
}

export interface ExpeditionState {
	readonly phase: AttemptPhase;
	readonly objective: string;
	readonly room: number;
	readonly rooms: number;
	readonly enemies: number;
	readonly loot: Counts;
	readonly upgrades: ReadonlyArray<string>;
	readonly extraction: "locked" | "available" | "confirming";
	readonly offer?: Offer;
	readonly boss?: { readonly name: string; readonly health: number; readonly max: number };
	/** Presente só no envio que encerra a tentativa. */
	readonly result?: ExpeditionResult;
}

export type ExpeditionCommand = { readonly kind: "choose"; readonly roomId: number; readonly upgrade: string } | { readonly kind: "leave" };
