import { findItem } from "../shared/catalog";
import { CELL_SIZE, placementCFrame } from "../shared/grid";
import { STRUCTURE_ITEM } from "../shared/protocol";
import { readStructure, structuresFolder } from "./world";

const tweens = game.GetService("TweenService");
const workspace = game.GetService("Workspace");

const MOVE = new TweenInfo(0.4, Enum.EasingStyle.Linear);
const ITEM_SIZE = new Vector3(1.4, 1.2, 1.4);
const POOL_LIMIT = 200;

const pool = new Array<Part>();
const container = new Instance("Folder");
container.Name = "GenesisItems";
container.Parent = workspace;

function acquire(): Part {
	const reused = pool.pop();
	if (reused) return reused;
	const part = new Instance("Part");
	part.Anchored = true;
	part.CanCollide = false;
	part.CanQuery = false;
	part.CanTouch = false;
	part.CastShadow = false;
	part.Size = ITEM_SIZE;
	part.Material = Enum.Material.Metal;
	return part;
}

function release(part: Part) {
	part.Parent = undefined;
	if (pool.size() < POOL_LIMIT) pool.push(part);
	else part.Destroy();
}

function trackBelt(model: Instance) {
	const structure = readStructure(model);
	if (!structure || structure.machine.id !== "belt") return;
	const origin = placementCFrame(structure.machine, structure.placement);
	const height = structure.machine.height + ITEM_SIZE.Y / 2;
	const start = origin.mul(new CFrame(0, height, CELL_SIZE / 2 - 0.7));
	const finish = origin.mul(new CFrame(0, height, -CELL_SIZE / 2 + 0.7));
	let shown: Part | undefined;
	let movement: Tween | undefined;

	function clear() {
		movement?.Cancel();
		movement = undefined;
		if (shown) release(shown);
		shown = undefined;
	}

	function refresh() {
		clear();
		const item = findItem(model.GetAttribute(STRUCTURE_ITEM));
		if (!item) return;
		shown = acquire();
		shown.Color = item.color;
		shown.CFrame = start;
		shown.Parent = container;
		movement = tweens.Create(shown, MOVE, { CFrame: finish });
		movement.Play();
	}

	model.GetAttributeChangedSignal(STRUCTURE_ITEM).Connect(refresh);
	model.AncestryChanged.Connect(() => {
		if (!model.IsDescendantOf(workspace)) clear();
	});
	refresh();
}

/** Desenha localmente os itens em trânsito. A posição lógica pertence ao servidor. */
export function mountBelts() {
	const folder = structuresFolder();
	folder.ChildAdded.Connect(trackBelt);
	for (const model of folder.GetChildren()) trackBelt(model);
}
