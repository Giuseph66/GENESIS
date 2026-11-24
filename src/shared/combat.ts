/** Ponto no plano do piso. O combate do Capítulo 1 acontece em arenas planas. */
export interface Flat {
	readonly x: number;
	readonly z: number;
}

export const PLAYER_COMBAT = {
	stamina: 100,
	regenDelay: 0.75,
	regenPerSecond: 25,
	dodgeCost: 25,
	dodgeCooldown: 1,
	dodgeInvulnerable: 0.35,
	dodgeSpeed: 60,
	dodgeSeconds: 0.22,
};

export type Shape = "arc" | "line" | "area";

export interface AttackType {
	readonly shape: Shape;
	readonly damage: number;
	/** Alcance em studs. Em "area", é o raio. */
	readonly range: number;
	/** Meia abertura do arco em radianos. */
	readonly halfAngle: number;
	/** Largura da linha em studs. */
	readonly width: number;
	readonly needsSight: boolean;
}

export type PlayerAttackId = "primary" | "secondary";

export const PLAYER_ATTACKS: { readonly [id in PlayerAttackId]: AttackType & { readonly cooldown: number } } = {
	primary: { shape: "arc", damage: 20, range: 8, halfAngle: math.rad(55), width: 0, needsSight: true, cooldown: 0.55 },
	secondary: { shape: "line", damage: 35, range: 45, halfAngle: 0, width: 5, needsSight: true, cooldown: 4 },
};

export interface EnemyAttack extends AttackType {
	/** Tempo de aviso antes do golpe. */
	readonly windup: number;
	readonly recover: number;
}

export type EnemyId = "drone" | "robot" | "guardian";

export interface EnemyType {
	readonly id: EnemyId;
	readonly name: string;
	readonly health: number;
	readonly speed: number;
	readonly sight: number;
	/** Distância máxima da origem durante a perseguição. */
	readonly leash: number;
	/** Distância que o inimigo procura manter do alvo. */
	readonly preferredRange: number;
	readonly attackCooldown: number;
	/** Usados em sequência. */
	readonly attacks: ReadonlyArray<EnemyAttack>;
	/** Abaixo desta fração de vida, encadeia `chain` golpes sem esperar a recarga. */
	readonly enrageBelow: number;
	readonly chain: number;
}

const ARC = { shape: "arc" as Shape, width: 0, needsSight: true };

export const ENEMIES: { readonly [id in EnemyId]: EnemyType } = {
	drone: {
		id: "drone",
		name: "Drone de reconhecimento",
		health: 40,
		speed: 12,
		sight: 50,
		leash: 60,
		preferredRange: 22,
		attackCooldown: 2.2,
		attacks: [
			{ shape: "line", damage: 12, range: 45, halfAngle: 0, width: 3, needsSight: true, windup: 0.9, recover: 0.5 },
		],
		enrageBelow: 0,
		chain: 1,
	},
	robot: {
		id: "robot",
		name: "Robô industrial corrompido",
		health: 80,
		speed: 10,
		sight: 40,
		leash: 60,
		preferredRange: 6,
		attackCooldown: 1.4,
		attacks: [{ ...ARC, damage: 18, range: 9, halfAngle: math.rad(60), windup: 0.75, recover: 1.1 }],
		enrageBelow: 0,
		chain: 1,
	},
	guardian: {
		id: "guardian",
		name: "Guardião Industrial",
		health: 360,
		speed: 9,
		sight: 80,
		leash: 80,
		preferredRange: 8,
		attackCooldown: 1.6,
		attacks: [
			{ ...ARC, damage: 24, range: 13, halfAngle: math.rad(55), windup: 0.9, recover: 1.1 },
			{ shape: "area", damage: 30, range: 17, halfAngle: 0, width: 0, needsSight: false, windup: 1.4, recover: 1.4 },
		],
		enrageBelow: 0.5,
		chain: 2,
	},
};

export function flatDistance(a: Flat, b: Flat): number {
	return math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
}

export function flatDirection(from: Flat, to: Flat): Flat | undefined {
	const distance = flatDistance(from, to);
	return distance < 0.001 ? undefined : { x: (to.x - from.x) / distance, z: (to.z - from.z) / distance };
}

/** Geometria do golpe. Linha de visão é conferida por quem conhece o cenário. */
export function isInsideAttack(attack: AttackType, origin: Flat, aim: Flat, target: Flat): boolean {
	const distance = flatDistance(origin, target);
	if (distance > attack.range) return false;
	if (attack.shape === "area" || distance < 0.001) return true;

	const along = (target.x - origin.x) * aim.x + (target.z - origin.z) * aim.z;
	if (attack.shape === "arc") return along / distance >= math.cos(attack.halfAngle);
	const across = math.abs((target.x - origin.x) * aim.z - (target.z - origin.z) * aim.x);
	return along >= 0 && across <= attack.width / 2;
}

export const COMBAT_REMOTE = "Combat";
export const COMBAT_SYNC_REMOTE = "CombatSync";
/** Servidor → cliente: acertos e danos confirmados, para efeitos. */
export const COMBAT_FX_REMOTE = "CombatFx";
/** Atributo do jogador, escrito pelo servidor enquanto a tentativa está ativa. */
export const IN_ENCOUNTER = "GenesisInEncounter";

export interface CombatCommand {
	readonly kind: PlayerAttackId | "dodge";
	readonly x: number;
	readonly z: number;
}

/** Tempos restantes, pois os relógios do cliente e do servidor diferem. */
export interface FighterState {
	readonly stamina: number;
	readonly primary: number;
	readonly secondary: number;
	readonly dodge: number;
	/** Pontos restantes do escudo temporário. */
	readonly shield: number;
	readonly damageScale: number;
	readonly cooldownScale: number;
}

export type CombatFx =
	| { readonly kind: "hit"; readonly position: Vector3; readonly amount: number; readonly killed: boolean; readonly target?: Model }
	| { readonly kind: "hurt"; readonly amount: number; readonly shielded: boolean };
