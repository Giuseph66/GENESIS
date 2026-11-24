/** Semente fixa: a mesma coordenada sempre gera o mesmo relevo. */
export const WORLD_SEED = 7193;
export const SEA_LEVEL = -12;
export const MIN_HEIGHT = -36;
export const MAX_HEIGHT = 140;

/** O platô do posto acompanha o grid de construção, de ±80 studs. A peça visível fica no modelo do place. */
const PLATEAU_START = 78;
const PLATEAU_END = 86;
const WILD_START = 88;
const WILD_END = 230;
const EDGE_WOBBLE = 10;

export type Biome = "plains" | "forest" | "desert" | "highland";

function smoothstep(from: number, to: number, value: number): number {
	const t = math.clamp((value - from) / (to - from), 0, 1);
	return t * t * (3 - 2 * t);
}

function lerp(from: number, to: number, t: number): number {
	return from + (to - from) * t;
}

/** Ruído entre -0,5 e 0,5. Cada camada tem um deslocamento próprio da semente. */
function noise(x: number, z: number, scale: number, layer: number): number {
	return math.noise(x / scale, z / scale, WORLD_SEED + layer * 17.31);
}

/** Distância à origem em formato quadrado, para acompanhar as bordas do grid. */
export function baseDistance(x: number, z: number): number {
	return math.max(math.abs(x), math.abs(z));
}

function wildHeight(x: number, z: number): number {
	const hills = noise(x, z, 260, 1) * 34 + noise(x, z, 95, 2) * 12 + noise(x, z, 30, 3) * 3;
	const mountainMask = smoothstep(0.02, 0.3, noise(x, z, 780, 4));
	const ridge = 1 - math.min(1, math.abs(noise(x, z, 340, 5)) * 2.6);
	const lakeMask = smoothstep(0.1, 0.32, noise(x, z, 520, 6)) * (1 - mountainMask);
	const height = 9 + hills + mountainMask * ridge * ridge * 105 - lakeMask * 34;
	return math.clamp(height, MIN_HEIGHT, MAX_HEIGHT);
}

export function terrainHeight(x: number, z: number): number {
	const wobble = math.clamp(noise(x, z, 60, 7) + 0.5, 0, 1) * EDGE_WOBBLE;
	const distance = baseDistance(x, z) - wobble;
	const rim = lerp(2, wildHeight(x, z), smoothstep(WILD_START, WILD_END, distance));
	return lerp(-8, rim, smoothstep(PLATEAU_START, PLATEAU_END, distance));
}

export function biomeAt(x: number, z: number, height: number): Biome {
	if (height > 48) return "highland";
	const moisture = noise(x, z, 640, 8);
	if (moisture < -0.16) return "desert";
	return moisture > 0.06 ? "forest" : "plains";
}
