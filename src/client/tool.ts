import { SWING_IMPACT, SWING_SECONDS } from "../shared/nodes";
import { isFirstPerson } from "./camera";
import { Shoulder, waitShoulder } from "./rig";

const players = game.GetService("Players");
const runService = game.GetService("RunService");
const workspace = game.GetService("Workspace");

const player = players.LocalPlayer;

/** Posição da picareta em relação à câmera, na primeira pessoa. */
const VIEW_OFFSET = new CFrame(1.9, -2.5, -3.9);

interface Pick {
	readonly handle: Part;
	readonly head: Part;
	readonly tip: Part;
}

function toolPart(name: string, size: Vector3, color: Color3, material: Enum.Material): Part {
	const part = new Instance("Part");
	part.Name = name;
	part.Size = size;
	part.Color = color;
	part.Material = material;
	part.Anchored = true;
	part.CanCollide = false;
	part.CanQuery = false;
	part.CanTouch = false;
	part.CastShadow = false;
	part.Massless = true;
	return part;
}

function createPick(): Pick {
	return {
		handle: toolPart("Cabo", new Vector3(0.24, 3.2, 0.24), Color3.fromRGB(92, 70, 52), Enum.Material.Wood),
		head: toolPart("Cabeça", new Vector3(0.4, 0.45, 2.4), Color3.fromRGB(120, 130, 142), Enum.Material.Metal),
		tip: toolPart("Ponta", new Vector3(0.3, 0.3, 0.6), Color3.fromRGB(255, 150, 51), Enum.Material.Neon),
	};
}

/** Ângulo do golpe: arma, desce rápido e volta. Zero é a pose de repouso. */
function swingAngle(elapsed: number): number {
	if (elapsed < 0 || elapsed >= SWING_SECONDS) return 0;
	const raise = SWING_IMPACT * 0.62;
	if (elapsed < raise) return math.sin((elapsed / raise) * (math.pi / 2)) * 1;
	if (elapsed < SWING_IMPACT) {
		const t = (elapsed - raise) / (SWING_IMPACT - raise);
		return 1 - 1.75 * t * t;
	}
	const t = (elapsed - SWING_IMPACT) / (SWING_SECONDS - SWING_IMPACT);
	return -0.75 * (1 - t);
}

export function mountTool() {
	const pick = createPick();
	const folder = new Instance("Folder");
	folder.Name = "GenesisTool";
	folder.Parent = workspace;
	for (const part of [pick.handle, pick.head, pick.tip]) part.Parent = folder;

	let startedAt = -math.huge;
	let visibleUntil = 0;
	let shoulder: Shoulder | undefined;
	let posed = false;

	function bindCharacter(character: Model) {
		shoulder = undefined;
		posed = false;
		task.spawn(() => {
			const found = waitShoulder(character);
			if (player.Character === character) shoulder = found;
		});
	}
	player.CharacterAdded.Connect(bindCharacter);
	if (player.Character) bindCharacter(player.Character);

	function setHidden(hidden: boolean) {
		const value = hidden ? 1 : 0;
		if (pick.handle.Transparency === value) return;
		for (const part of [pick.handle, pick.head, pick.tip]) part.Transparency = value;
	}

	function pose(grip: CFrame) {
		pick.handle.CFrame = grip.mul(new CFrame(0, 0.9, 0));
		pick.head.CFrame = grip.mul(new CFrame(0, 2.35, 0));
		pick.tip.CFrame = grip.mul(new CFrame(0, 2.35, -1.4));
	}

	runService.BindToRenderStep("GenesisTool", Enum.RenderPriority.Camera.Value + 10, () => {
		const now = os.clock();
		const camera = workspace.CurrentCamera;
		const character = player.Character;
		const angle = swingAngle(now - startedAt);
		const shown = now < visibleUntil;
		// Fora do golpe a junta é de outros sistemas, como o combate: só devolve uma vez.
		if (shoulder && shoulder.isAlive() && (shown || posed)) {
			shoulder.lift(shown ? 0.9 + angle * 1.1 : 0);
			posed = shown;
		}
		if (!shown || !camera || !character) return setHidden(true);

		setHidden(false);
		if (isFirstPerson()) {
			const sway = math.sin(now * 2) * 0.02;
			const grip = camera.CFrame.mul(VIEW_OFFSET).mul(new CFrame(0, sway, 0));
			pose(grip.mul(CFrame.Angles(-0.35 + angle * 0.95, 0.25, 0.1)));
			return;
		}
		const hand = character.FindFirstChild("RightHand") ?? character.FindFirstChild("Right Arm");
		if (!hand?.IsA("BasePart")) return setHidden(true);
		const reach = hand.Name === "RightHand" ? 0 : -0.9;
		pose(hand.CFrame.mul(new CFrame(0, reach, 0)).mul(CFrame.Angles(-math.pi / 2, 0, 0)));
	});

	return {
		/** Inicia um golpe e mantém a ferramenta à mostra por alguns segundos. */
		swing: () => {
			startedAt = os.clock();
			visibleUntil = startedAt + 2.5;
		},
	};
}

export type MountedTool = ReturnType<typeof mountTool>;
