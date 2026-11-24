import { isFirstPerson, setFirstPerson } from "./camera";

const contextActions = game.GetService("ContextActionService");
const input = game.GetService("UserInputService");
const players = game.GetService("Players");
const runService = game.GetService("RunService");
const workspace = game.GetService("Workspace");

const player = players.LocalPlayer;
const SINK = "GenesisDroneKeys";
const STEP = "GenesisDrone";
const SINK_PRIORITY = 3000;
const PAN_SPEED = 0.95;
const TURN_SPEED = 0.006;
const SMOOTH = 12;
const MIN_HEIGHT = 18;
const MAX_HEIGHT = 110;
const MIN_PITCH = math.rad(30);
const MAX_PITCH = math.rad(86);
/** O foco do drone fica sobre o platô do posto. */
const LIMIT = 90;

const MOVE_KEYS = [
	Enum.KeyCode.W,
	Enum.KeyCode.A,
	Enum.KeyCode.S,
	Enum.KeyCode.D,
	Enum.KeyCode.Up,
	Enum.KeyCode.Down,
	Enum.KeyCode.Left,
	Enum.KeyCode.Right,
	Enum.KeyCode.Space,
];

let active = false;
let wasFirstPerson = false;
let focus = new Vector3();
let shownFocus = new Vector3();
let yaw = 0;
let pitch = math.rad(60);
let height = 46;
let shownHeight = 46;

function axis(positive: Array<Enum.KeyCode>, negative: Array<Enum.KeyCode>): number {
	const held = (keys: Array<Enum.KeyCode>) => (keys.some((key) => input.IsKeyDown(key)) ? 1 : 0);
	return held(positive) - held(negative);
}

function clampFocus(point: Vector3): Vector3 {
	return new Vector3(math.clamp(point.X, -LIMIT, LIMIT), 0, math.clamp(point.Z, -LIMIT, LIMIT));
}

function pan(right: number, forward: number) {
	const heading = CFrame.Angles(0, yaw, 0);
	focus = clampFocus(focus.add(heading.mul(new Vector3(right, 0, -forward))));
}

function step(delta: number) {
	const camera = workspace.CurrentCamera;
	if (!camera) return;
	const speed = shownHeight * PAN_SPEED * delta;
	const right = axis([Enum.KeyCode.D, Enum.KeyCode.Right], [Enum.KeyCode.A, Enum.KeyCode.Left]);
	const forward = axis([Enum.KeyCode.W, Enum.KeyCode.Up], [Enum.KeyCode.S, Enum.KeyCode.Down]);
	pan(right * speed, forward * speed);

	const blend = 1 - math.exp(-delta * SMOOTH);
	shownFocus = shownFocus.Lerp(focus, blend);
	shownHeight += (height - shownHeight) * blend;
	const turn = new CFrame(shownFocus).mul(CFrame.Angles(0, yaw, 0)).mul(CFrame.Angles(-pitch, 0, 0));
	camera.CameraType = Enum.CameraType.Scriptable;
	camera.CFrame = turn.mul(new CFrame(0, 0, shownHeight));
	const turning = input.IsMouseButtonPressed(Enum.UserInputType.MouseButton2);
	input.MouseBehavior = turning ? Enum.MouseBehavior.LockCurrentPosition : Enum.MouseBehavior.Default;
}

export function isDroneActive(): boolean {
	return active;
}

export function zoomDrone(amount: number) {
	height = math.clamp(height * (1 + amount), MIN_HEIGHT, MAX_HEIGHT);
}

/** Vista de cima para construir. O personagem fica parado onde está. */
export function enterDrone() {
	const root = player.Character?.FindFirstChild("HumanoidRootPart");
	const camera = workspace.CurrentCamera;
	if (active || !camera || !root?.IsA("BasePart")) return;
	active = true;
	wasFirstPerson = player.CameraMode === Enum.CameraMode.LockFirstPerson || isFirstPerson();
	player.CameraMode = Enum.CameraMode.Classic;
	const [, cameraYaw] = camera.CFrame.ToEulerAnglesYXZ();
	yaw = cameraYaw;
	focus = clampFocus(root.Position);
	shownFocus = focus;
	shownHeight = math.min(height, 24);
	contextActions.BindActionAtPriority(SINK, () => Enum.ContextActionResult.Sink, false, SINK_PRIORITY, ...MOVE_KEYS);
	runService.BindToRenderStep(STEP, Enum.RenderPriority.Camera.Value + 1, step);
}

export function leaveDrone() {
	if (!active) return;
	active = false;
	runService.UnbindFromRenderStep(STEP);
	contextActions.UnbindAction(SINK);
	input.MouseBehavior = Enum.MouseBehavior.Default;
	const camera = workspace.CurrentCamera;
	if (camera) {
		const humanoid = player.Character?.FindFirstChildOfClass("Humanoid");
		const root = humanoid?.RootPart;
		// O motor continua da última direção: devolve uma vista na altura dos olhos.
		if (root) {
			const heading = new CFrame(root.Position).mul(CFrame.Angles(0, yaw, 0));
			camera.CFrame = CFrame.lookAt(heading.mul(new Vector3(0, 4, 11)), heading.mul(new Vector3(0, 1.5, 0)));
		}
		camera.CameraType = Enum.CameraType.Custom;
		if (humanoid) camera.CameraSubject = humanoid;
	}
	if (wasFirstPerson) setFirstPerson(true);
}

input.InputChanged.Connect((event) => {
	if (!active || event.UserInputType !== Enum.UserInputType.MouseMovement) return;
	if (!input.IsMouseButtonPressed(Enum.UserInputType.MouseButton2)) return;
	yaw -= event.Delta.X * TURN_SPEED;
	pitch = math.clamp(pitch + event.Delta.Y * TURN_SPEED, MIN_PITCH, MAX_PITCH);
});
let lastPan: Vector2 | undefined;
input.TouchPan.Connect((_, total, __, state, processed) => {
	if (!active || processed) return;
	const moved = lastPan ? total.sub(lastPan) : new Vector2();
	lastPan = state === Enum.UserInputState.End ? undefined : total;
	pan(-moved.X * shownHeight * 0.003, moved.Y * shownHeight * 0.003);
});
input.TouchPinch.Connect((_, __, velocity, ___, processed) => {
	if (active && !processed) zoomDrone(-velocity * 0.02);
});
