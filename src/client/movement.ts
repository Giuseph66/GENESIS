import { IN_ENCOUNTER } from "../shared/combat";
import { SPEED_SCALE } from "../shared/expedition";
import { isFirstPerson } from "./camera";
import { dust, shakeCamera } from "./effects";
import { playSound } from "./sounds";
import { button } from "./ui";

const players = game.GetService("Players");
const input = game.GetService("UserInputService");
const runService = game.GetService("RunService");
const workspace = game.GetService("Workspace");

const player = players.LocalPlayer;
const WALK_SPEED = 16;
const SPRINT_SPEED = 27;
const WALK_FOV = 70;
const SPRINT_FOV = 80;
const DUST_INTERVAL = 0.22;
/** Quedas acima disto afundam a câmera e levantam poeira. */
const HARD_LANDING = 28;

export function mountMovement(gui: ScreenGui) {
	let wantsSprint = false;
	let bobTime = 0;
	let dip = 0;
	let lastDust = 0;
	let fallSpeed = 0;

	function bindCharacter(character: Model) {
		const humanoid = character.WaitForChild("Humanoid") as Humanoid;
		humanoid.StateChanged.Connect((_, state) => {
			const root = humanoid.RootPart;
			if (state !== Enum.HumanoidStateType.Landed || !root) return;
			if (fallSpeed > 8) {
				dust(root.Position.sub(new Vector3(0, humanoid.HipHeight + 0.8, 0)));
				dip = math.clamp(fallSpeed / 60, 0.15, 0.9);
			}
			if (fallSpeed > HARD_LANDING) {
				shakeCamera(fallSpeed / 40);
				playSound("land", 0.5, 0.9);
			}
			fallSpeed = 0;
		});
	}
	player.CharacterAdded.Connect(bindCharacter);
	if (player.Character) task.spawn(bindCharacter, player.Character);

	input.InputBegan.Connect((event, processed) => {
		if (!processed && event.KeyCode === Enum.KeyCode.LeftShift) wantsSprint = true;
	});
	input.InputEnded.Connect((event) => {
		if (event.KeyCode === Enum.KeyCode.LeftShift) wantsSprint = false;
	});
	input.WindowFocusReleased.Connect(() => {
		wantsSprint = false;
	});

	if (input.TouchEnabled && !input.KeyboardEnabled) {
		const run = button(gui, "Correr", "Correr", UDim2.fromOffset(72, 48), () => {
			wantsSprint = !wantsSprint;
			run.Text = wantsSprint ? "Andar" : "Correr";
		});
		run.AnchorPoint = new Vector2(1, 1);
		run.Position = new UDim2(1, -24, 1, -150);
	}

	runService.RenderStepped.Connect((delta) => {
		const camera = workspace.CurrentCamera;
		const humanoid = player.Character?.FindFirstChildOfClass("Humanoid");
		const root = humanoid?.RootPart;
		if (!camera || !humanoid || !root || humanoid.Health <= 0) return;

		// Na expedição, a velocidade pertence ao combate e às melhorias.
		const inEncounter = player.GetAttribute(IN_ENCOUNTER) === true;
		const isMoving = humanoid.MoveDirection.Magnitude > 0.1;
		const sprinting = wantsSprint && isMoving && !inEncounter;
		const scale = player.GetAttribute(SPEED_SCALE);
		const upgraded = inEncounter && typeIs(scale, "number") ? scale : 1;
		humanoid.WalkSpeed = (sprinting ? SPRINT_SPEED : WALK_SPEED) * upgraded;

		const blend = 1 - math.exp(-delta * 8);
		camera.FieldOfView += ((sprinting ? SPRINT_FOV : WALK_FOV) - camera.FieldOfView) * blend;

		const vertical = root.AssemblyLinearVelocity.Y;
		if (vertical < 0) fallSpeed = math.max(fallSpeed, -vertical);
		const grounded = humanoid.FloorMaterial !== Enum.Material.Air;
		if (grounded && vertical > -2 && fallSpeed < 8) fallSpeed = 0;

		const speed = new Vector3(root.AssemblyLinearVelocity.X, 0, root.AssemblyLinearVelocity.Z).Magnitude;
		if (grounded && speed > 2) bobTime += delta * speed * 0.55;
		const bob = isFirstPerson() && grounded && speed > 2 ? math.min(speed / SPRINT_SPEED, 1) * 0.16 : 0;
		dip *= math.exp(-delta * 9);
		humanoid.CameraOffset = new Vector3(math.cos(bobTime) * bob * 0.6, math.abs(math.sin(bobTime)) * bob - dip, 0);

		if (sprinting && grounded && os.clock() - lastDust > DUST_INTERVAL && !isFirstPerson()) {
			lastDust = os.clock();
			dust(root.Position.sub(new Vector3(0, humanoid.HipHeight + 0.8, 0)));
		}
	});
}
