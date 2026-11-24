import { isFirstPerson } from "./camera";
import { isDroneActive } from "./drone";
import { theme } from "./ui";

const players = game.GetService("Players");
const runService = game.GetService("RunService");
const workspace = game.GetService("Workspace");

const player = players.LocalPlayer;
/** Ao lado do ombro, à frente da câmera na primeira pessoa. */
const SIDE = new Vector3(-2.8, 2.6, -1);
const FIRST_PERSON = new Vector3(-4.6, 2, -7);
const FOLLOW = 6;

function piece(name: string, size: Vector3, color: Color3, material: Enum.Material, shape: Enum.PartType): Part {
	const part = new Instance("Part");
	part.Name = name;
	part.Shape = shape;
	part.Size = size;
	part.Color = color;
	part.Material = material;
	part.Anchored = true;
	part.CanCollide = false;
	part.CanQuery = false;
	part.CanTouch = false;
	part.CastShadow = false;
	return part;
}

/** ECHO acompanha o jogador desde o início. É só presença local: não altera o jogo. */
export function mountEcho() {
	const folder = new Instance("Folder");
	folder.Name = "GenesisEcho";
	folder.Parent = workspace;
	const shell = piece("Casco", new Vector3(0.8, 0.8, 0.8), Color3.fromRGB(52, 60, 70), Enum.Material.Metal, Enum.PartType.Ball);
	const eye = piece("Olho", new Vector3(0.42, 0.42, 0.42), theme.cyan, Enum.Material.Neon, Enum.PartType.Ball);
	const fins = [0, 1].map(() => piece("Aleta", new Vector3(0.12, 0.5, 0.28), theme.cyan, Enum.Material.Neon, Enum.PartType.Block));
	const light = new Instance("PointLight");
	light.Color = theme.cyan;
	light.Range = 12;
	light.Brightness = 0.6;
	light.Parent = eye;
	const parts = [shell, eye, ...fins];
	for (const part of parts) part.Parent = folder;

	let position: Vector3 | undefined;
	let speakingUntil = 0;
	runService.BindToRenderStep("GenesisEcho", Enum.RenderPriority.Camera.Value + 8, (delta) => {
		const camera = workspace.CurrentCamera;
		const root = player.Character?.FindFirstChild("HumanoidRootPart");
		const hidden = !camera || !root?.IsA("BasePart") || isDroneActive();
		for (const part of parts) part.LocalTransparencyModifier = hidden ? 1 : 0;
		light.Enabled = !hidden;
		if (hidden || !camera || !root?.IsA("BasePart")) return;

		const now = os.clock();
		const anchor = isFirstPerson() ? camera.CFrame.PointToWorldSpace(FIRST_PERSON) : root.CFrame.PointToWorldSpace(SIDE);
		const goal = anchor.add(new Vector3(0, math.sin(now * 2) * 0.25, 0));
		// Um salto grande é teletransporte: ECHO aparece junto.
		const isFar = position === undefined || position.sub(goal).Magnitude > 60;
		const current: Vector3 = isFar || position === undefined ? goal : position.Lerp(goal, 1 - math.exp(-delta * FOLLOW));
		position = current;
		const speaking = now < speakingUntil;
		const facing = CFrame.lookAt(current, camera.CFrame.Position);
		shell.CFrame = facing;
		eye.CFrame = facing.mul(new CFrame(0, 0, -0.26));
		const spin = now * (speaking ? 6 : 1.6);
		fins.forEach((fin, index) => {
			fin.CFrame = facing.mul(CFrame.Angles(0, 0, spin + index * math.pi)).mul(new CFrame(0.72, 0, 0));
		});
		eye.Color = speaking ? theme.orange : theme.cyan;
		light.Brightness = speaking ? 1.6 + math.sin(now * 20) * 0.5 : 0.6;
	});
	return {
		speak: (seconds: number) => {
			speakingUntil = os.clock() + seconds;
		},
	};
}
