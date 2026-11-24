import type { MachineType } from "./catalog";

export const CELL_SIZE = 4;
/** Células construíveis vão de -HALF_EXTENT a HALF_EXTENT - 1, sobre a clareira plana. */
export const HALF_EXTENT = 48;
/** Distância máxima, em studs, entre o jogador e o centro da construção. */
export const BUILD_REACH = 60;

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
