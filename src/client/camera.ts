import { theme } from "./ui";

const players = game.GetService("Players");
const input = game.GetService("UserInputService");
const runService = game.GetService("RunService");
const workspace = game.GetService("Workspace");

const player = players.LocalPlayer;
const THIRD_DISTANCE = 11;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 20;
const FIRST_PERSON_LIMIT = 1.5;

/** Motivos para soltar o cursor na primeira pessoa, como um painel aberto. */
const cursorRequests = new Set<string>();
/** Direção em que a câmera ficou parada enquanto o cursor está solto. */
let frozen: CFrame | undefined;

export function requestCursor(reason: string, wanted: boolean) {
	if (wanted) cursorRequests.add(reason);
	else cursorRequests.delete(reason);
}

export function isFirstPerson(): boolean {
	const camera = workspace.CurrentCamera;
	const head = player.Character?.FindFirstChild("Head");
	if (!camera || !head?.IsA("BasePart")) return false;
	return camera.CFrame.Position.sub(head.Position).Magnitude < FIRST_PERSON_LIMIT;
}

export function setFirstPerson(wanted: boolean) {
	if (wanted) {
		player.CameraMode = Enum.CameraMode.LockFirstPerson;
		return;
	}
	player.CameraMode = Enum.CameraMode.Classic;
	// Afasta a câmera e só então devolve o zoom livre.
	player.CameraMaxZoomDistance = THIRD_DISTANCE;
	player.CameraMinZoomDistance = THIRD_DISTANCE;
	task.delay(0.15, () => {
		if (player.CameraMode !== Enum.CameraMode.Classic) return;
		player.CameraMaxZoomDistance = MAX_ZOOM;
		player.CameraMinZoomDistance = MIN_ZOOM;
	});
}

/** Alterna entre primeira e terceira pessoa. */
export function toggleCamera() {
	// Com a câmera sob outro controle, como o drone, trocar não teria efeito visível.
	if (workspace.CurrentCamera?.CameraType === Enum.CameraType.Scriptable) return;
	setFirstPerson(player.CameraMode !== Enum.CameraMode.LockFirstPerson && !isFirstPerson());
}

/** Ponto da tela usado para mirar: centro na primeira pessoa, cursor na terceira. */
export function aimPoint(): Vector2 {
	const camera = workspace.CurrentCamera;
	if (camera && isFirstPerson() && cursorRequests.size() === 0) return camera.ViewportSize.div(2);
	return input.GetMouseLocation();
}

export function mountCamera(gui: ScreenGui) {
	const dot = new Instance("Frame");
	dot.Name = "Mira";
	dot.AnchorPoint = new Vector2(0.5, 0.5);
	dot.Position = UDim2.fromScale(0.5, 0.5);
	dot.Size = UDim2.fromOffset(6, 6);
	dot.BackgroundColor3 = theme.text;
	dot.BorderSizePixel = 0;
	dot.Visible = false;
	const round = new Instance("UICorner");
	round.CornerRadius = new UDim(1, 0);
	round.Parent = dot;
	const outline = new Instance("UIStroke");
	outline.Color = theme.surface;
	outline.Transparency = 0.3;
	outline.Parent = dot;
	// A mira precisa do centro real da tela, sem o recuo da barra superior.
	const overlay = new Instance("ScreenGui");
	overlay.Name = "GenesisMira";
	overlay.IgnoreGuiInset = true;
	overlay.ResetOnSpawn = false;
	overlay.Parent = gui.Parent;
	dot.Parent = overlay;

	function toggleFree() {
		requestCursor("tab", !cursorRequests.has("tab"));
	}
	input.InputBegan.Connect((event, processed) => {
		if (event.KeyCode === Enum.KeyCode.Tab && isFirstPerson()) toggleFree();
		if (!processed && event.KeyCode === Enum.KeyCode.V) toggleCamera();
	});
	input.WindowFocusReleased.Connect(() => requestCursor("tab", false));
	// Na primeira pessoa o motor prende o mouse a cada quadro. Para soltá-lo, a câmera sai do
	// controle do motor e fica parada na cabeça até o último painel fechar.
	runService.BindToRenderStep("GenesisCursor", Enum.RenderPriority.Camera.Value + 2, () => {
		const camera = workspace.CurrentCamera;
		const head = player.Character?.FindFirstChild("Head");
		if (!camera) return;
		const wantsCursor = cursorRequests.size() > 0;
		if (wantsCursor && !frozen && camera.CameraType === Enum.CameraType.Custom && isFirstPerson()) {
			frozen = camera.CFrame.Rotation;
		}
		if (frozen && (!wantsCursor || !head?.IsA("BasePart"))) {
			frozen = undefined;
			camera.CameraType = Enum.CameraType.Custom;
		}
		if (frozen && head?.IsA("BasePart")) {
			camera.CameraType = Enum.CameraType.Scriptable;
			camera.CFrame = new CFrame(head.Position).mul(frozen);
			input.MouseBehavior = Enum.MouseBehavior.Default;
		}
		const aiming = isFirstPerson() && !wantsCursor;
		dot.Visible = aiming;
		// A mira substitui o cursor do sistema.
		input.MouseIconEnabled = !aiming;
		if (!isFirstPerson() && cursorRequests.has("tab")) requestCursor("tab", false);
	});
}
