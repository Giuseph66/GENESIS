import type { MachineType } from "./catalog";

export const CELL_SIZE = 4;
/** Células construíveis vão de -HALF_EXTENT a HALF_EXTENT - 1, sobre o platô do posto. */
export const HALF_EXTENT = 20;
/** A construção usa câmera de drone: basta o jogador estar no platô do posto. */
export const BUILD_REACH = 260;

export interface Placement {
	/** Célula de menor X e Z ocupada. */
	readonly cx: number;
	readonly cz: number;
	/** Passos de 90° no eixo vertical, de 0 a 3. */
	readonly rotation: number;
}

interface CellRect {
	readonly minX: number;
	readonly maxX: number;
	readonly minZ: number;
	readonly maxZ: number;
}

/** Cenário fixo e a faixa de acesso de cada peça. */
const RESERVED: ReadonlyArray<CellRect> = [
	{ minX: -1, maxX: 0, minZ: 3, maxZ: 5 }, // ponto de despertar
	{ minX: -1, maxX: 0, minZ: -2, maxZ: 0 }, // terminal
	{ minX: -5, maxX: -3, minZ: -4, maxZ: -2 }, // depósito de ferro
	{ minX: 2, maxX: 4, minZ: -4, maxZ: -2 }, // depósito de carvão
	{ minX: -2, maxX: 1, minZ: -9, maxZ: -6 }, // abrigo
	{ minX: -8, maxX: -5, minZ: 2, maxZ: 6 }, // contêineres e barris
	{ minX: 5, maxX: 7, minZ: -7, maxZ: -5 }, // contêiner e barril
	{ minX: -8, maxX: -3, minZ: -7, maxZ: -7 }, // tubulação oeste
	{ minX: 2, maxX: 7, minZ: -7, maxZ: -7 }, // tubulação leste
	{ minX: 7, maxX: 7, minZ: 6, maxZ: 6 }, // poste
	{ minX: -3, maxX: -3, minZ: -8, maxZ: -8 }, // antena
];

/** Veios de ferro. As peças visíveis ficam em assets/installation.model.json. */
const VEINS: ReadonlyArray<CellRect> = [
	{ minX: 8, maxX: 13, minZ: -4, maxZ: 1 },
	{ minX: -14, maxX: -9, minZ: -4, maxZ: 1 },
];

/** Gerador fixo, já presente no posto. */
export const EMERGENCY_GENERATOR: Placement = { cx: 5, cz: 2, rotation: 0 };

/** Direção da frente de uma construção, em células, para cada rotação. */
const DIRECTIONS: ReadonlyArray<{ readonly x: number; readonly z: number }> = [
	{ x: 0, z: -1 },
	{ x: 1, z: 0 },
	{ x: 0, z: 1 },
	{ x: -1, z: 0 },
];

export function footprint(machine: MachineType, rotation: number): LuaTuple<[number, number]> {
	const turned = rotation % 2 === 1;
	return $tuple(turned ? machine.depth : machine.width, turned ? machine.width : machine.depth);
}

export function cellKey(cx: number, cz: number): string {
	return `${cx},${cz}`;
}

export function occupiedCells(machine: MachineType, placement: Placement): Array<string> {
	const [width, depth] = footprint(machine, placement.rotation);
	const cells = new Array<string>();
	for (let x = 0; x < width; x++) {
		for (let z = 0; z < depth; z++) cells.push(cellKey(placement.cx + x, placement.cz + z));
	}
	return cells;
}

export function isInsideGrid(machine: MachineType, placement: Placement): boolean {
	const [width, depth] = footprint(machine, placement.rotation);
	return (
		placement.cx >= -HALF_EXTENT &&
		placement.cz >= -HALF_EXTENT &&
		placement.cx + width <= HALF_EXTENT &&
		placement.cz + depth <= HALF_EXTENT
	);
}

export function isReserved(machine: MachineType, placement: Placement): boolean {
	const [width, depth] = footprint(machine, placement.rotation);
	return RESERVED.some(
		(rect) =>
			placement.cx <= rect.maxX &&
			placement.cx + width - 1 >= rect.minX &&
			placement.cz <= rect.maxZ &&
			placement.cz + depth - 1 >= rect.minZ,
	);
}

/** Centro da construção no nível do piso. */
export function placementCenter(machine: MachineType, placement: Placement): Vector3 {
	const [width, depth] = footprint(machine, placement.rotation);
	return new Vector3((placement.cx + width / 2) * CELL_SIZE, 0, (placement.cz + depth / 2) * CELL_SIZE);
}

/** Posiciona a construção de modo que seu centro fique na célula mais próxima do ponto. */
export function placementAt(machine: MachineType, point: Vector3, rotation: number): Placement {
	const [width, depth] = footprint(machine, rotation);
	return {
		cx: math.round(point.X / CELL_SIZE - width / 2),
		cz: math.round(point.Z / CELL_SIZE - depth / 2),
		rotation,
	};
}

export function isOnVein(machine: MachineType, placement: Placement): boolean {
	const [width, depth] = footprint(machine, placement.rotation);
	return VEINS.some(
		(rect) =>
			placement.cx >= rect.minX &&
			placement.cx + width - 1 <= rect.maxX &&
			placement.cz >= rect.minZ &&
			placement.cz + depth - 1 <= rect.maxZ,
	);
}

/** Células logo à frente da construção, em ordem estável. */
export function frontCells(machine: MachineType, placement: Placement): Array<string> {
	const [width, depth] = footprint(machine, placement.rotation);
	const direction = DIRECTIONS[placement.rotation];
	const cells = new Array<string>();
	if (direction.x === 0) {
		const z = direction.z < 0 ? placement.cz - 1 : placement.cz + depth;
		for (let x = 0; x < width; x++) cells.push(cellKey(placement.cx + x, z));
	} else {
		const x = direction.x < 0 ? placement.cx - 1 : placement.cx + width;
		for (let z = 0; z < depth; z++) cells.push(cellKey(x, placement.cz + z));
	}
	return cells;
}

/** Orientação da construção no mundo, com a frente em -Z local. */
export function placementCFrame(machine: MachineType, placement: Placement): CFrame {
	return new CFrame(placementCenter(machine, placement)).mul(CFrame.Angles(0, (-placement.rotation * math.pi) / 2, 0));
}
