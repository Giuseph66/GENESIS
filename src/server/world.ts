import { addNode, removeNode, WILD_NODES } from "./nodes";
import { baseDistance, Biome, biomeAt, MAX_HEIGHT, SEA_LEVEL, terrainHeight, WORLD_SEED } from "./terrain";

const players = game.GetService("Players");
const workspace = game.GetService("Workspace");
const terrain = workspace.Terrain;

const VOXEL = 4;
const CHUNK_VOXELS = 32;
const CHUNK_SIZE = CHUNK_VOXELS * VOXEL;
const MIN_Y = -48;

const LOAD_RADIUS = 4.5;
/** Maior que LOAD_RADIUS para não recriar blocos quando o jogador anda na divisa. */
const UNLOAD_RADIUS = 6.5;
const STEP_SECONDS = 0.05;
/** Tempo de CPU por quadro antes de ceder a vez. */
const FRAME_BUDGET = 0.006;

const SCENERY_PER_CHUNK = 22;
const SCENERY_MIN_DISTANCE = 100;
/** A superfície do terreno suave fica cerca de 2 studs acima da altura calculada. */
const SURFACE_OFFSET = 2;

interface Chunk {
	readonly cx: number;
	readonly cz: number;
	readonly top: number;
	readonly scenery: Folder;
	readonly nodes: Array<string>;
}

const chunks = new Map<string, Chunk>();
const container = new Instance("Folder");
container.Name = "GenesisWorld";
container.Parent = workspace;

let frameStart = 0;

/** Divide a geração entre quadros. Só o laço do mundo chama, portanto não há corrida entre blocos. */
function breathe() {
	if (os.clock() - frameStart < FRAME_BUDGET) return;
	task.wait();
	frameStart = os.clock();
}

function chunkRegion(cx: number, cz: number, top: number): Region3 {
	const min = new Vector3(cx * CHUNK_SIZE, MIN_Y, cz * CHUNK_SIZE);
	return new Region3(min, new Vector3(min.X + CHUNK_SIZE, top, min.Z + CHUNK_SIZE));
}

function surfaceMaterial(height: number, slope: number, biome: Biome): Enum.Material {
	if (height > 92) return Enum.Material.Snow;
	if (slope > 1.1) return Enum.Material.Rock;
	if (height < SEA_LEVEL + 4) return height < SEA_LEVEL - 6 ? Enum.Material.Mud : Enum.Material.Sand;
	if (biome === "highland") return height > 66 ? Enum.Material.Slate : Enum.Material.Rock;
	if (biome === "desert") return Enum.Material.Sand;
	return biome === "forest" ? Enum.Material.LeafyGrass : Enum.Material.Grass;
}

/** Escreve o relevo e devolve o topo da região usada, para o descarte. */
function writeTerrain(cx: number, cz: number): number {
	const heights = new Array<Array<number>>();
	let highest = SEA_LEVEL;
	for (let x = 0; x <= CHUNK_VOXELS; x++) {
		const row = new Array<number>(CHUNK_VOXELS + 1);
		for (let z = 0; z <= CHUNK_VOXELS; z++) {
			const height = terrainHeight(cx * CHUNK_SIZE + (x + 0.5) * VOXEL, cz * CHUNK_SIZE + (z + 0.5) * VOXEL);
			row[z] = height;
			highest = math.max(highest, height);
		}
		heights[x] = row;
		breathe();
	}

	const layers = math.ceil((math.min(highest, MAX_HEIGHT) - MIN_Y) / VOXEL) + 1;
	const top = MIN_Y + layers * VOXEL;
	// Linhas inteiras de ar, água ou rocha são compartilhadas: WriteVoxels só lê os arrays.
	const airRow = new Array<Enum.Material>(CHUNK_VOXELS, Enum.Material.Air);
	const waterRow = new Array<Enum.Material>(CHUNK_VOXELS, Enum.Material.Water);
	const rockRow = new Array<Enum.Material>(CHUNK_VOXELS, Enum.Material.Rock);
	const emptyRow = new Array<number>(CHUNK_VOXELS, 0);
	const fullRow = new Array<number>(CHUNK_VOXELS, 1);

	const materials = new Array<Array<Array<Enum.Material>>>();
	const occupancy = new Array<Array<Array<number>>>();
	for (let x = 0; x < CHUNK_VOXELS; x++) {
		const row = heights[x];
		const nextRow = heights[x + 1];
		let lowest = math.huge;
		let peak = -math.huge;
		const surfaces = new Array<Enum.Material>(CHUNK_VOXELS);
		for (let z = 0; z < CHUNK_VOXELS; z++) {
			const height = row[z];
			lowest = math.min(lowest, height);
			peak = math.max(peak, height);
			const slope = (math.abs(nextRow[z] - height) + math.abs(row[z + 1] - height)) / VOXEL;
			const worldX = cx * CHUNK_SIZE + (x + 0.5) * VOXEL;
			const worldZ = cz * CHUNK_SIZE + (z + 0.5) * VOXEL;
			surfaces[z] = surfaceMaterial(height, slope, biomeAt(worldX, worldZ, height));
		}

		const materialSlice = new Array<Array<Enum.Material>>(layers);
		const occupancySlice = new Array<Array<number>>(layers);
		for (let y = 0; y < layers; y++) {
			const bottom = MIN_Y + y * VOXEL;
			const isWet = bottom + VOXEL <= SEA_LEVEL;
			if (bottom >= peak) {
				materialSlice[y] = isWet ? waterRow : airRow;
				occupancySlice[y] = isWet ? fullRow : emptyRow;
				continue;
			}
			if (bottom + VOXEL * 4 <= lowest) {
				materialSlice[y] = rockRow;
				occupancySlice[y] = fullRow;
				continue;
			}
			const materialRow = new Array<Enum.Material>(CHUNK_VOXELS);
			const occupancyRow = new Array<number>(CHUNK_VOXELS);
			for (let z = 0; z < CHUNK_VOXELS; z++) {
				const height = row[z];
				const filled = math.clamp((height - bottom) / VOXEL, 0, 1);
				if (isWet && filled < 0.5) {
					materialRow[z] = Enum.Material.Water;
					occupancyRow[z] = 1;
				} else if (filled <= 0) {
					materialRow[z] = Enum.Material.Air;
					occupancyRow[z] = 0;
				} else {
					materialRow[z] = height - bottom > 10 ? Enum.Material.Ground : surfaces[z];
					occupancyRow[z] = filled;
				}
			}
			materialSlice[y] = materialRow;
			occupancySlice[y] = occupancyRow;
		}
		materials[x] = materialSlice;
		occupancy[x] = occupancySlice;
		breathe();
	}

	terrain.WriteVoxels(chunkRegion(cx, cz, top), VOXEL, materials, occupancy);
	return top;
}

function piece(
	parent: Instance,
	name: string,
	size: Vector3,
	cframe: CFrame,
	color: Color3,
	material: Enum.Material,
	shape: Enum.PartType = Enum.PartType.Block,
): Part {
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

const UPRIGHT = CFrame.Angles(0, 0, math.pi / 2);

function trunk(parent: Instance, base: Vector3, height: number, width: number, color: Color3) {
	const cframe = new CFrame(base.X, base.Y + height / 2 - 1.5, base.Z).mul(UPRIGHT);
	piece(parent, "Tronco", new Vector3(height, width, width), cframe, color, Enum.Material.Wood, Enum.PartType.Cylinder);
}

function crown(parent: Instance, position: Vector3, size: Vector3, color: Color3, shape: Enum.PartType) {
	const cframe = shape === Enum.PartType.Cylinder ? new CFrame(position).mul(UPRIGHT) : new CFrame(position);
	piece(parent, "Copa", size, cframe, color, Enum.Material.LeafyGrass, shape).CanCollide = false;
}

function addOak(parent: Instance, base: Vector3, random: Random) {
	const height = random.NextNumber(10, 17);
	trunk(parent, base, height, 2, Color3.fromRGB(92, 70, 52));
	const leaf = Color3.fromRGB(random.NextInteger(58, 84), random.NextInteger(112, 142), random.NextInteger(56, 76));
	const size = random.NextNumber(8, 12);
	const top = base.add(new Vector3(0, height + size * 0.15, 0));
	crown(parent, top, new Vector3(size, size, size), leaf, Enum.PartType.Ball);
	const side = new Vector3(random.NextNumber(-3, 3), -2, random.NextNumber(-3, 3));
	crown(parent, top.add(side), new Vector3(size * 0.75, size * 0.75, size * 0.75), leaf, Enum.PartType.Ball);
}

function addPine(parent: Instance, base: Vector3, random: Random) {
	const height = random.NextNumber(16, 26);
	trunk(parent, base, height, 1.6, Color3.fromRGB(80, 60, 46));
	const leaf = Color3.fromRGB(random.NextInteger(34, 50), random.NextInteger(82, 104), random.NextInteger(54, 70));
	for (let i = 0; i < 4; i++) {
		const width = 10 - i * 2.2;
		const position = base.add(new Vector3(0, height * 0.4 + i * height * 0.17, 0));
		crown(parent, position, new Vector3(height * 0.16, width, width), leaf, Enum.PartType.Cylinder);
	}
}

function addCactus(parent: Instance, base: Vector3, random: Random) {
	const height = random.NextNumber(6, 11);
	const color = Color3.fromRGB(86, 126, 72);
	const cframe = new CFrame(base.X, base.Y + height / 2 - 1, base.Z).mul(UPRIGHT);
	piece(parent, "Cacto", new Vector3(height, 1.8, 1.8), cframe, color, Enum.Material.Grass, Enum.PartType.Cylinder);
	const arm = base.add(new Vector3(1.6, height * 0.55, 0));
	piece(parent, "Cacto", new Vector3(height * 0.4, 1.2, 1.2), new CFrame(arm).mul(UPRIGHT), color, Enum.Material.Grass, Enum.PartType.Cylinder);
}

function addBush(parent: Instance, base: Vector3, random: Random) {
	const size = random.NextNumber(2.5, 4.5);
	const color = Color3.fromRGB(random.NextInteger(62, 90), random.NextInteger(112, 136), random.NextInteger(58, 74));
	crown(parent, base.add(new Vector3(0, size * 0.25, 0)), new Vector3(size, size, size), color, Enum.PartType.Ball);
}

function addRock(parent: Instance, base: Vector3, random: Random) {
	const gray = random.NextInteger(96, 128);
	const color = Color3.fromRGB(gray, gray + 3, gray + 6);
	const count = random.NextInteger(1, 3);
	for (let i = 0; i < count; i++) {
		const size = new Vector3(random.NextNumber(3, 8), random.NextNumber(2.5, 6), random.NextNumber(3, 8));
		const offset = new Vector3(random.NextNumber(-3, 3), 0, random.NextNumber(-3, 3));
		const turn = CFrame.Angles(random.NextNumber(-0.4, 0.4), random.NextNumber(0, 6), random.NextNumber(-0.4, 0.4));
		piece(parent, "Rocha", size, new CFrame(base.add(offset)).mul(turn), color, Enum.Material.Slate);
	}
}

/** Vestígios da instalação: dão referência visual e reforçam o abandono. */
function addRuin(parent: Instance, base: Vector3, random: Random) {
	const concrete = Color3.fromRGB(122, 126, 130);
	const turn = random.NextNumber(0, 6);
	const origin = new CFrame(base).mul(CFrame.Angles(0, turn, 0));
	piece(parent, "Ruína", new Vector3(18, 1.5, 18), origin, concrete, Enum.Material.Concrete);
	for (const x of [-8, 8]) {
		for (const z of [-8, 8]) {
			const height = random.NextNumber(4, 15);
			const tilt = CFrame.Angles(random.NextNumber(-0.12, 0.12), 0, random.NextNumber(-0.12, 0.12));
			const cframe = origin.mul(new CFrame(x, height / 2, z)).mul(tilt);
			piece(parent, "Pilar", new Vector3(2, height, 2), cframe, concrete, Enum.Material.Concrete);
		}
	}
	const wall = origin.mul(new CFrame(0, 3, -8));
	piece(parent, "Parede", new Vector3(12, 7, 1.2), wall, Color3.fromRGB(96, 102, 110), Enum.Material.CorrodedMetal);
	const lamp = origin.mul(new CFrame(0, 5.5, -7.2));
	const light = piece(parent, "Luz de emergência", new Vector3(2.4, 0.5, 0.4), lamp, Color3.fromRGB(255, 150, 51), Enum.Material.Neon);
	const glow = new Instance("PointLight");
	glow.Color = light.Color;
	glow.Range = 18;
	glow.Parent = light;
}

function addOre(parent: Instance, base: Vector3, random: Random, id: string, item: "iron_ore" | "coal") {
	const model = new Instance("Model");
	model.Name = item === "coal" ? "Jazida de carvão" : "Jazida de ferro";
	const turn = CFrame.Angles(0, random.NextNumber(0, 6), random.NextNumber(-0.2, 0.2));
	const stone = item === "coal" ? Color3.fromRGB(70, 72, 78) : Color3.fromRGB(112, 104, 100);
	const body = new CFrame(base.add(new Vector3(0, 0.8, 0))).mul(turn);
	model.PrimaryPart = piece(model, "Pedra", new Vector3(6, 4.5, 5.5), body, stone, Enum.Material.Slate);
	const vein = item === "coal" ? Color3.fromRGB(24, 25, 28) : Color3.fromRGB(214, 128, 78);
	const material = item === "coal" ? Enum.Material.Slate : Enum.Material.Metal;
	for (let i = 0; i < 5; i++) {
		const angle = (i / 5) * math.pi * 2;
		const spot = new CFrame(math.cos(angle) * 2.7, random.NextNumber(0.2, 2), math.sin(angle) * 2.5);
		const lump = body.mul(spot).mul(CFrame.Angles(random.NextNumber(0, 3), angle, 0));
		piece(model, "Veio", new Vector3(1.4, 1.4, 1.4), lump, vein, material);
	}
	model.Parent = parent;
	addNode(model, id, WILD_NODES[item]);
}

function addScenery(cx: number, cz: number): LuaTuple<[Folder, Array<string>]> {
	const folder = new Instance("Folder");
	folder.Name = `Bloco ${cx},${cz}`;
	folder.Parent = container;
	const nodes = new Array<string>();
	const random = new Random(bit32.bxor(WORLD_SEED, cx * 73856093, cz * 19349663));
	for (let i = 0; i < SCENERY_PER_CHUNK; i++) {
		const x = (cx + random.NextNumber()) * CHUNK_SIZE;
		const z = (cz + random.NextNumber()) * CHUNK_SIZE;
		const roll = random.NextNumber();
		const density = random.NextNumber();
		// Cada item tem seu próprio fluxo: filtrar um não muda os demais.
		const detail = new Random(random.NextInteger(1, 2 ** 30));
		const height = terrainHeight(x, z);
		if (baseDistance(x, z) < SCENERY_MIN_DISTANCE || height < SEA_LEVEL + 1) continue;

		const base = new Vector3(x, height + SURFACE_OFFSET, z);
		const biome = biomeAt(x, z, height);
		const id = `${cx},${cz},${i}`;
		if (roll < 0.07) {
			nodes.push(id);
			addOre(folder, base, detail, id, "iron_ore");
		} else if (roll < 0.12) {
			nodes.push(id);
			addOre(folder, base, detail, id, "coal");
		} else if (roll < 0.125) {
			addRuin(folder, base, detail);
		} else if (roll < 0.26) {
			addRock(folder, base, detail);
		} else if (biome === "forest") {
			if (roll < 0.7) addOak(folder, base, detail);
			else addPine(folder, base, detail);
		} else if (biome === "plains") {
			if (density < 0.3) addOak(folder, base, detail);
			else if (density < 0.55) addBush(folder, base, detail);
		} else if (biome === "desert") {
			if (density < 0.35) addCactus(folder, base, detail);
		} else if (height < 88 && density < 0.5) {
			addPine(folder, base, detail);
		}
		breathe();
	}
	return $tuple(folder, nodes);
}

function loadChunk(cx: number, cz: number) {
	const top = writeTerrain(cx, cz);
	const [scenery, nodes] = addScenery(cx, cz);
	chunks.set(`${cx},${cz}`, { cx, cz, top, scenery, nodes });
}

function unloadChunk(key: string, chunk: Chunk) {
	for (const id of chunk.nodes) removeNode(id);
	terrain.FillRegion(chunkRegion(chunk.cx, chunk.cz, chunk.top), VOXEL, Enum.Material.Air);
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

function nextMissing(centers: Array<Vector2>): { cx: number; cz: number } | undefined {
	let best: { cx: number; cz: number } | undefined;
	let bestDistance = math.huge;
	const reach = math.ceil(LOAD_RADIUS);
	for (const center of centers) {
		const baseX = math.floor(center.X);
		const baseZ = math.floor(center.Y);
		for (let cx = baseX - reach; cx <= baseX + reach; cx++) {
			for (let cz = baseZ - reach; cz <= baseZ + reach; cz++) {
				if (chunks.has(`${cx},${cz}`)) continue;
				const distance = nearestDistance(centers, cx, cz);
				if (distance <= LOAD_RADIUS && distance < bestDistance) {
					best = { cx, cz };
					bestDistance = distance;
				}
			}
		}
	}
	return best;
}

function dropFar(centers: Array<Vector2>) {
	const expired = new Array<[string, Chunk]>();
	for (const [key, chunk] of chunks) {
		if (nearestDistance(centers, chunk.cx, chunk.cz) > UNLOAD_RADIUS) expired.push([key, chunk]);
	}
	for (const [key, chunk] of expired) {
		unloadChunk(key, chunk);
		breathe();
	}
}

const GROUND_COLORS: ReadonlyArray<[Enum.Material, Color3]> = [
	[Enum.Material.Grass, Color3.fromRGB(84, 108, 58)],
	[Enum.Material.LeafyGrass, Color3.fromRGB(74, 98, 54)],
	[Enum.Material.Rock, Color3.fromRGB(118, 114, 108)],
	[Enum.Material.Slate, Color3.fromRGB(94, 96, 100)],
	[Enum.Material.Sand, Color3.fromRGB(214, 190, 138)],
	[Enum.Material.Ground, Color3.fromRGB(124, 98, 70)],
	[Enum.Material.Mud, Color3.fromRGB(92, 74, 56)],
	[Enum.Material.Snow, Color3.fromRGB(236, 242, 248)],
];

/** Gera o mundo em volta dos jogadores e descarta o que ficou longe. */
export function startWorld() {
	for (const [material, color] of GROUND_COLORS) terrain.SetMaterialColor(material, color);
	terrain.WaterColor = Color3.fromRGB(28, 110, 140);
	terrain.WaterTransparency = 0.55;
	task.spawn(() => {
		while (true) {
			frameStart = os.clock();
			const centers = playerCenters();
			if (centers.size() > 0) {
				const missing = nextMissing(centers);
				if (missing) loadChunk(missing.cx, missing.cz);
				dropFar(centers);
			}
			task.wait(STEP_SECONDS);
		}
	});
}
