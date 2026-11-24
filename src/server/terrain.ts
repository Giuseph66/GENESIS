/** Semente fixa: a mesma coordenada sempre gera o mesmo relevo. */
export const WORLD_SEED = 7193;

const BASE_HEIGHT = 10;
/** A clareira inicial é uma peça de 512 studs (metade = 256) salva em assets/installation.model.json. */
const CLEARING_START = 205;
const CLEARING_END = 245;
const WILD_START = 500;

function smoothstep(from: number, to: number, value: number): number {
	const t = math.clamp((value - from) / (to - from), 0, 1);
	return t * t * (3 - 2 * t);
}

function lerp(from: number, to: number, t: number): number {
	return from + (to - from) * t;
}

/** Distância à origem em formato quadrado, para acompanhar as bordas da clareira. */
export function clearingDistance(x: number, z: number): number {
	return math.max(math.abs(x), math.abs(z));
}

export function terrainHeight(x: number, z: number): number {
	const wild =
		BASE_HEIGHT +
		math.noise(x / 420, z / 420, WORLD_SEED + 0.37) * 56 +
		math.noise(x / 130, z / 130, WORLD_SEED + 11.61) * 18 +
		math.noise(x / 40, z / 40, WORLD_SEED + 23.19) * 4;
	const distance = clearingDistance(x, z);
	const rim = lerp(3, wild, smoothstep(CLEARING_END, WILD_START, distance));
	return lerp(-8, rim, smoothstep(CLEARING_START, CLEARING_END, distance));
}
