import { findItem, ItemId, ITEMS } from "../shared/catalog";
import type { PlayerState } from "../shared/protocol";
import { onState } from "./connection";
import { label, theme } from "./ui";

const runService = game.GetService("RunService");
const tweens = game.GetService("TweenService");
const workspace = game.GetService("Workspace");

let shake = 0;

/** Tremor curto de câmera, somado depois que o motor a posiciona. */
export function shakeCamera(strength: number) {
	shake = math.max(shake, strength);
}

/** Estilhaços locais. O servidor não precisa conhecê-los. */
export function burst(position: Vector3, color: Color3, count: number) {
	for (let i = 0; i < count; i++) {
		const shard = new Instance("Part");
		shard.Size = new Vector3(0.35, 0.35, 0.35).mul(0.6 + math.random());
		shard.Color = color;
		shard.Material = Enum.Material.Slate;
		shard.CanCollide = false;
		shard.CanQuery = false;
		shard.CanTouch = false;
		shard.CastShadow = false;
		shard.CFrame = new CFrame(position).mul(CFrame.Angles(math.random() * 6, math.random() * 6, 0));
		shard.AssemblyLinearVelocity = new Vector3(math.random() * 24 - 12, 10 + math.random() * 14, math.random() * 24 - 12);
		shard.Parent = workspace;
		tweens.Create(shard, new TweenInfo(0.7), { Transparency: 1 }).Play();
		task.delay(0.7, () => shard.Destroy());
	}
}

export function dust(position: Vector3) {
	for (let i = 0; i < 4; i++) {
		const puff = new Instance("Part");
		puff.Shape = Enum.PartType.Ball;
		puff.Size = new Vector3(0.8, 0.8, 0.8);
		puff.Color = Color3.fromRGB(176, 168, 150);
		puff.Material = Enum.Material.SmoothPlastic;
		puff.Transparency = 0.45;
		puff.Anchored = true;
		puff.CanCollide = false;
		puff.CanQuery = false;
		puff.CanTouch = false;
		puff.CastShadow = false;
		const offset = new Vector3(math.random() * 2 - 1, 0.2, math.random() * 2 - 1);
		puff.Position = position.add(offset);
		puff.Parent = workspace;
		const goal = { Transparency: 1, Size: new Vector3(2, 2, 2), Position: puff.Position.add(offset.add(new Vector3(0, 0.8, 0))) };
		tweens.Create(puff, new TweenInfo(0.5), goal).Play();
		task.delay(0.5, () => puff.Destroy());
	}
}

/** Lista de ganhos que sobe e some, para todo item que entra no inventário. */
function mountPickups(gui: ScreenGui) {
	const feed = new Instance("Frame");
	feed.Name = "Ganhos";
	feed.BackgroundTransparency = 1;
	feed.AnchorPoint = new Vector2(0.5, 1);
	feed.Position = new UDim2(0.5, 0, 0.6, 0);
	feed.Size = UDim2.fromOffset(260, 120);
	feed.Parent = gui;
	const layout = new Instance("UIListLayout");
	layout.VerticalAlignment = Enum.VerticalAlignment.Bottom;
	layout.SortOrder = Enum.SortOrder.LayoutOrder;
	layout.Parent = feed;

	let previous: PlayerState | undefined;
	let order = 0;
	function show(item: ItemId, amount: number) {
		order += 1;
		const line = label(feed, `+${amount} ${findItem(item)?.name ?? item}`, new UDim2(), new UDim2(1, 0, 0, 24), 18, Enum.Font.GothamBold, theme.text);
		line.TextXAlignment = Enum.TextXAlignment.Center;
		line.TextStrokeTransparency = 0.4;
		line.LayoutOrder = order;
		tweens.Create(line, new TweenInfo(0.6, Enum.EasingStyle.Quad, Enum.EasingDirection.In, 0, false, 0.8), {
			TextTransparency: 1,
			TextStrokeTransparency: 1,
		}).Play();
		task.delay(1.4, () => line.Destroy());
	}
	onState((state) => {
		if (previous) {
			for (const item of ITEMS) {
				const gained = state.inventory[item.id] - previous.inventory[item.id];
				if (gained > 0) show(item.id, gained);
			}
		}
		previous = state;
	});
}

export function mountEffects(gui: ScreenGui) {
	mountPickups(gui);
	runService.BindToRenderStep("GenesisShake", Enum.RenderPriority.Camera.Value + 5, (delta) => {
		const camera = workspace.CurrentCamera;
		if (!camera || shake < 0.01) return;
		const jitter = () => (math.random() - 0.5) * shake;
		camera.CFrame = camera.CFrame.mul(CFrame.Angles(jitter() * 0.03, jitter() * 0.03, 0)).mul(new CFrame(jitter() * 0.2, jitter() * 0.2, 0));
		shake *= math.exp(-delta * 12);
	});
}
