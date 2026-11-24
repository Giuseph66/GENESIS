import { clearingDistance, terrainHeight, WORLD_SEED } from "./terrain";

const players = game.GetService("Players");
const workspace = game.GetService("Workspace");
const terrain = workspace.Terrain;

const VOXEL = 4;
const CHUNK_VOXELS = 32;
const CHUNK_SIZE = CHUNK_VOXELS * VOXEL;
const MIN_Y = -40;
const HEIGHT_VOXELS = 32;
const MAX_Y = MIN_Y + HEIGHT_VOXELS * VOXEL;

const LOAD_RADIUS = 4;
/** Maior que LOAD_RADIUS para não recriar blocos quando o jogador anda na divisa. */
const UNLOAD_RADIUS = 6;
const CHUNKS_PER_STEP = 1;
const STEP_SECONDS = 0.05;

const SCENERY_PER_CHUNK = 7;
const SCENERY_MIN_DISTANCE = 270;
/** A superfície do terreno suave fica cerca de 2 studs acima da altura calculada. */
const SURFACE_OFFSET = 2;

interface Chunk {
	cx: number;
	cz: number;
	scenery: Folder;
}

const chunks = new Map<string, Chunk>();
const container = new Instance("Folder");
container.Name = "GenesisWorld";
container.Parent = workspace;

function chunkRegion(cx: number, cz: number): Region3 {
	const min = new Vector3(cx * CHUNK_SIZE, MIN_Y, cz * CHUNK_SIZE);
	return new Region3(min, new Vector3(min.X + CHUNK_SIZE, MAX_Y, min.Z + CHUNK_SIZE));
}

function writeTerrain(cx: number, cz: number) {
	const materials = new Array<Array<Array<Enum.Material>>>();
	const occupancy = new Array<Array<Array<number>>>();
	const heights = new Array<Array<number>>();
	for (let x = 0; x < CHUNK_VOXELS; x++) {
		materials[x] = [];
		occupancy[x] = [];
		heights[x] = [];
		for (let z = 0; z < CHUNK_VOXELS; z++) {
			heights[x][z] = terrainHeight(cx * CHUNK_SIZE + (x + 0.5) * VOXEL, cz * CHUNK_SIZE + (z + 0.5) * VOXEL);
		}
	}

	for (let x = 0; x < CHUNK_VOXELS; x++) {
		for (let y = 0; y < HEIGHT_VOXELS; y++) {
			const bottom = MIN_Y + y * VOXEL;
			const materialRow = new Array<Enum.Material>(CHUNK_VOXELS);
			const occupancyRow = new Array<number>(CHUNK_VOXELS);
			for (let z = 0; z < CHUNK_VOXELS; z++) {
				const height = heights[x][z];
				const filled = math.clamp((height - bottom) / VOXEL, 0, 1);
				let material: Enum.Material = Enum.Material.Air;
				if (filled > 0) {
					const depth = height - bottom;
					if (height > 36) material = Enum.Material.Rock;
					else if (depth > 10) material = Enum.Material.Ground;
					else if (height < -12) material = Enum.Material.Mud;
					else material = Enum.Material.Grass;
				}
				materialRow[z] = material;
				occupancyRow[z] = filled;
			}
			materials[x][y] = materialRow;
			occupancy[x][y] = occupancyRow;
		}
	}

	terrain.WriteVoxels(chunkRegion(cx, cz), VOXEL, materials, occupancy);
}

function sceneryPart(
	parent: Instance,
	name: string,
	size: Vector3,
	cframe: CFrame,
	color: Color3,
	material: Enum.Material,
	shape: Enum.PartType,
) {
	const part = new Instance("Part");
	part.Name = name;
	part.Anchored = true;
	part.Shape = shape;
	part.Size = size;
	part.CFrame = cframe;
	part.Color = color;
	part.Material = material;
	part.Parent = parent;
	return part;
}

function addTree(parent: Instance, position: Vector3, random: Random) {
	const height = random.NextNumber(9, 16);
	const trunk = new CFrame(position.X, position.Y + height / 2 - 1, position.Z).mul(CFrame.Angles(0, 0, math.pi / 2));
	const bark = Color3.fromRGB(92, 70, 52);
	sceneryPart(parent, "Tronco", new Vector3(height, 1.8, 1.8), trunk, bark, Enum.Material.Wood, Enum.PartType.Cylinder);

	const crown = random.NextNumber(8, 12);
	const leaf = Color3.fromRGB(random.NextInteger(58, 82), random.NextInteger(112, 140), random.NextInteger(58, 76));
	const top = new CFrame(position.X, position.Y + height + crown * 0.2, position.Z);
	const leaves = sceneryPart(parent, "Copa", new Vector3(crown, crown, crown), top, leaf, Enum.Material.Grass, Enum.PartType.Ball);
	leaves.CanCollide = false;
}

function addRock(parent: Instance, position: Vector3, random: Random) {
	const size = new Vector3(random.NextNumber(3, 8), random.NextNumber(2, 5), random.NextNumber(3, 8));
	const cframe = new CFrame(position).mul(CFrame.Angles(random.NextNumber(-0.3, 0.3), random.NextNumber(0, 6), random.NextNumber(-0.3, 0.3)));
	sceneryPart(parent, "Rocha", size, cframe, Color3.fromRGB(112, 116, 120), Enum.Material.Slate, Enum.PartType.Block);
}

function addScenery(cx: number, cz: number): Folder {
	const folder = new Instance("Folder");
	folder.Name = `Bloco ${cx},${cz}`;
	const random = new Random(bit32.bxor(WORLD_SEED, cx * 73856093, cz * 19349663));
	for (let i = 0; i < SCENERY_PER_CHUNK; i++) {
		const x = (cx + random.NextNumber()) * CHUNK_SIZE;
		const z = (cz + random.NextNumber()) * CHUNK_SIZE;
		const isTree = random.NextNumber() < 0.7;
		const y = terrainHeight(x, z);
		if (clearingDistance(x, z) < SCENERY_MIN_DISTANCE) continue;

		const position = new Vector3(x, y + SURFACE_OFFSET, z);
		if (isTree && y < 34) addTree(folder, position, random);
		else addRock(folder, position, random);
	}
	folder.Parent = container;
	return folder;
}

function loadChunk(cx: number, cz: number) {
	writeTerrain(cx, cz);
	chunks.set(`${cx},${cz}`, { cx, cz, scenery: addScenery(cx, cz) });
}

function unloadChunk(key: string, chunk: Chunk) {
	terrain.FillRegion(chunkRegion(chunk.cx, chunk.cz), VOXEL, Enum.Material.Air);
	chunk.scenery.Destroy();
	chunks.delete(key);
}

/** Posição de cada jogador medida em blocos. Sem personagem, ninguém precisa do terreno. */
function playerCenters(): Array<Vector2> {
	const centers = new Array<Vector2>();
	for (const player of players.GetPlayers()) {
		const root = player.Character?.FindFirstChild("HumanoidRootPart");
		if (root?.IsA("BasePart")) {
			centers.push(new Vector2(root.Position.X / CHUNK_SIZE, root.Position.Z / CHUNK_SIZE));
		}
	}
	return centers;
}

function nearestDistance(centers: Array<Vector2>, cx: number, cz: number): number {
	let nearest = math.huge;
	for (const center of centers) {
		nearest = math.min(nearest, center.sub(new Vector2(cx + 0.5, cz + 0.5)).Magnitude);
	}
	return nearest;
}

function step(centers: Array<Vector2>) {
	const missing = new Map<string, { cx: number; cz: number; distance: number }>();
	for (const center of centers) {
		const baseX = math.floor(center.X);
		const baseZ = math.floor(center.Y);
		for (let cx = baseX - LOAD_RADIUS; cx <= baseX + LOAD_RADIUS; cx++) {
			for (let cz = baseZ - LOAD_RADIUS; cz <= baseZ + LOAD_RADIUS; cz++) {
				const key = `${cx},${cz}`;
				if (chunks.has(key) || missing.has(key)) continue;
				const distance = nearestDistance(centers, cx, cz);
				if (distance <= LOAD_RADIUS) missing.set(key, { cx, cz, distance });
			}
		}
	}

	const queue = new Array<{ cx: number; cz: number; distance: number }>();
	for (const [, candidate] of missing) queue.push(candidate);
	queue.sort((a, b) => a.distance < b.distance);
	for (let i = 0; i < math.min(CHUNKS_PER_STEP, queue.size()); i++) {
		loadChunk(queue[i].cx, queue[i].cz);
	}

	const expired = new Array<[string, Chunk]>();
	for (const [key, chunk] of chunks) {
		if (nearestDistance(centers, chunk.cx, chunk.cz) > UNLOAD_RADIUS) expired.push([key, chunk]);
	}
	for (const [key, chunk] of expired) unloadChunk(key, chunk);
}

/** Gera o mundo em volta dos jogadores e descarta o que ficou longe. */
export function startWorld() {
	task.spawn(() => {
		while (true) {
			const centers = playerCenters();
			if (centers.size() > 0) step(centers);
			task.wait(STEP_SECONDS);
		}
	});
}
