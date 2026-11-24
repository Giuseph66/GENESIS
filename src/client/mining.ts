import { findItem } from "../shared/catalog";
import { IN_ENCOUNTER } from "../shared/combat";
import { NODE_DEPLETED, NODE_ID, NODE_ITEM, NODE_REACH, NODE_TAG, SWING_IMPACT, SWING_SECONDS } from "../shared/nodes";
import { aimPoint, isFirstPerson } from "./camera";
import { send } from "./connection";
import { burst, shakeCamera } from "./effects";
import { playSound } from "./sounds";
import { MountedTool } from "./tool";
import { button, theme } from "./ui";

const collection = game.GetService("CollectionService");
const players = game.GetService("Players");
const input = game.GetService("UserInputService");
const runService = game.GetService("RunService");
const tweens = game.GetService("TweenService");
const workspace = game.GetService("Workspace");

const player = players.LocalPlayer;
const SEARCH_INTERVAL = 0.1;

interface Target {
	readonly instance: PVInstance;
	readonly id: string;
	readonly body: BasePart;
}

function bodyOf(instance: PVInstance): BasePart | undefined {
	if (instance.IsA("BasePart")) return instance;
	return instance.IsA("Model") ? instance.PrimaryPart ?? instance.FindFirstChildWhichIsA("BasePart") : undefined;
}

function rootPart(): BasePart | undefined {
	const character = player.Character;
	const humanoid = character?.FindFirstChildOfClass("Humanoid");
	const root = character?.FindFirstChild("HumanoidRootPart");
	return humanoid && humanoid.Health > 0 && root?.IsA("BasePart") ? root : undefined;
}

function asTarget(instance: Instance): Target | undefined {
	const id = instance.GetAttribute(NODE_ID);
	if (!instance.IsA("PVInstance") || !typeIs(id, "string") || instance.GetAttribute(NODE_DEPLETED) === true) return undefined;
	const body = bodyOf(instance);
	return body && { instance, id, body };
}

/** Prefere a jazida sob a mira. Sem ela, usa a mais próxima ao alcance. */
function findTarget(root: BasePart): Target | undefined {
	const screen = aimPoint();
	const ray = workspace.CurrentCamera?.ViewportPointToRay(screen.X, screen.Y);
	let nearest: Target | undefined;
	let best = math.huge;
	for (const instance of collection.GetTagged(NODE_TAG)) {
		const target = instance.IsDescendantOf(workspace) ? asTarget(instance) : undefined;
		if (!target) continue;
		const pivot = target.instance.GetPivot().Position;
		const distance = pivot.sub(root.Position).Magnitude;
		if (distance > NODE_REACH) continue;
		// Aproxima a mira pela distância do centro da jazida ao raio da câmera.
		const along = ray ? math.max(0, pivot.sub(ray.Origin).Dot(ray.Direction)) : 0;
		const miss = ray ? pivot.sub(ray.Origin.add(ray.Direction.mul(along))).Magnitude : math.huge;
		const score = miss < 4 ? miss - 100 : distance;
		if (score < best) {
			best = score;
			nearest = target;
		}
	}
	return nearest;
}

/** Sacode só a imagem local. A jazida volta ao lugar no fim. */
function wobble(target: Target) {
	const body = target.body;
	const origin = body.CFrame;
	const tilt = origin.mul(CFrame.Angles((math.random() - 0.5) * 0.14, 0, (math.random() - 0.5) * 0.14));
	const back = tweens.Create(body, new TweenInfo(0.16, Enum.EasingStyle.Back), { CFrame: origin });
	body.CFrame = tilt;
	back.Play();
}

/** `isBusy` indica que o clique pertence a outra ação, como construir. */
export function mountMining(gui: ScreenGui, tool: MountedTool, isBusy: () => boolean) {
	let target: Target | undefined;
	let holdingKey = false;
	let holdingMouse = false;
	let holdingTouch = false;
	let swinging = false;
	let wobbling = false;
	let lastSearch = 0;

	const highlight = new Instance("Highlight");
	highlight.FillTransparency = 0.85;
	highlight.FillColor = theme.orange;
	highlight.OutlineColor = theme.orange;
	highlight.DepthMode = Enum.HighlightDepthMode.Occluded;
	highlight.Enabled = false;
	highlight.Parent = gui;

	const prompt = new Instance("BillboardGui");
	prompt.Name = "Minerar";
	prompt.Size = UDim2.fromOffset(220, 46);
	prompt.StudsOffset = new Vector3(0, 4, 0);
	prompt.AlwaysOnTop = true;
	prompt.Active = true;
	prompt.Enabled = false;
	prompt.ResetOnSpawn = false;
	// Billboard aninhado em ScreenGui não é desenhado.
	prompt.Parent = gui.Parent;
	const text = button(prompt, "Minerar", "", UDim2.fromScale(1, 1), () => {});
	text.BackgroundTransparency = 0.25;
	text.InputBegan.Connect((event) => {
		if (event.UserInputType === Enum.UserInputType.Touch) holdingTouch = true;
	});
	text.InputEnded.Connect((event) => {
		if (event.UserInputType === Enum.UserInputType.Touch) holdingTouch = false;
	});

	function swing(current: Target) {
		swinging = true;
		tool.swing();
		const root = rootPart();
		if (root && !isFirstPerson()) {
			const pivot = current.instance.GetPivot().Position;
			const facing = new Vector3(pivot.X, root.Position.Y, pivot.Z);
			if (facing.sub(root.Position).Magnitude > 0.5) root.CFrame = CFrame.lookAt(root.Position, facing);
		}
		task.delay(SWING_IMPACT, () => {
			if (!current.instance.IsDescendantOf(workspace)) return;
			send({ kind: "mine", nodeId: current.id });
			const item = findItem(current.instance.GetAttribute(NODE_ITEM));
			burst(current.body.Position.add(new Vector3(0, 1, 0)), item?.color ?? theme.text, 7);
			shakeCamera(0.5);
			playSound("hit", 0.7, 0.75 + math.random() * 0.2, 0.18);
			if (wobbling) return;
			wobbling = true;
			wobble(current);
			task.delay(0.18, () => {
				wobbling = false;
			});
		});
		task.delay(SWING_SECONDS, () => {
			swinging = false;
		});
	}

	input.InputBegan.Connect((event, processed) => {
		if (processed) return;
		if (event.KeyCode === Enum.KeyCode.E) holdingKey = true;
		else if (event.UserInputType === Enum.UserInputType.MouseButton1) holdingMouse = true;
	});
	input.InputEnded.Connect((event) => {
		if (event.KeyCode === Enum.KeyCode.E) holdingKey = false;
		else if (event.UserInputType === Enum.UserInputType.MouseButton1) holdingMouse = false;
	});
	input.WindowFocusReleased.Connect(() => {
		holdingKey = false;
		holdingMouse = false;
		holdingTouch = false;
	});

	runService.RenderStepped.Connect(() => {
		const root = rootPart();
		const available = root !== undefined && player.GetAttribute(IN_ENCOUNTER) !== true && !isBusy();
		if (os.clock() - lastSearch > SEARCH_INTERVAL) {
			lastSearch = os.clock();
			target = available && root ? findTarget(root) : undefined;
			const item = target && findItem(target.instance.GetAttribute(NODE_ITEM));
			highlight.Adornee = target?.instance;
			highlight.Enabled = target !== undefined;
			prompt.Adornee = target?.body;
			prompt.Enabled = target !== undefined;
			if (item) text.Text = input.KeyboardEnabled ? `Segure E: minerar ${item.name.lower()}` : `Minerar ${item.name.lower()}`;
			if (!target) holdingTouch = false;
		}
		// Clique só minera na primeira pessoa, onde a mira está sempre sobre o mundo.
		const holding = holdingKey || holdingTouch || (holdingMouse && isFirstPerson());
		if (available && holding && target && !swinging) swing(target);
	});
}
