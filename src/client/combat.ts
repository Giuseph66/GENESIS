import {
	COMBAT_FX_REMOTE,
	COMBAT_REMOTE,
	COMBAT_SYNC_REMOTE,
	CombatCommand,
	CombatFx,
	Flat,
	FighterState,
	IN_ENCOUNTER,
	PLAYER_ATTACKS,
	PLAYER_COMBAT,
	PlayerAttackId,
} from "../shared/combat";
import { SPEED_SCALE } from "../shared/expedition";
import { Fighter } from "../shared/fighter";
import { REMOTES_FOLDER } from "../shared/protocol";
import { findShoulder } from "./rig";
import { button, label, panel, scaleToFit, theme } from "./ui";

const debris = game.GetService("Debris");
const input = game.GetService("UserInputService");
const players = game.GetService("Players");
const replicatedStorage = game.GetService("ReplicatedStorage");
const runService = game.GetService("RunService");
const soundService = game.GetService("SoundService");
const tweens = game.GetService("TweenService");
const workspace = game.GetService("Workspace");

const player = players.LocalPlayer;

const FIRST_PERSON_DISTANCE = 1.5;
const SHAKE_DECAY = 6;
const SOUND = {
	swing: "rbxasset://sounds/action_jump.mp3",
	hit: "rbxasset://sounds/action_jump_land.mp3",
	kill: "rbxasset://sounds/impact_explosion_03.mp3",
	hurt: "rbxasset://sounds/ouch.ogg",
};

function rootPart(): BasePart | undefined {
	const root = player.Character?.FindFirstChild("HumanoidRootPart");
	return root?.IsA("BasePart") ? root : undefined;
}

function flatten(vector: Vector3): Flat | undefined {
	const length = math.sqrt(vector.X ** 2 + vector.Z ** 2);
	return length < 0.01 ? undefined : { x: vector.X / length, z: vector.Z / length };
}

function isFirstPerson(camera: Camera): boolean {
	const head = player.Character?.FindFirstChild("Head");
	return head !== undefined && head.IsA("BasePart") && camera.CFrame.Position.sub(head.Position).Magnitude < FIRST_PERSON_DISTANCE;
}

/** Em primeira pessoa e no toque, a câmera mira. Em terceira, o ponteiro do mouse. */
function readAim(root: BasePart): Flat | undefined {
	const camera = workspace.CurrentCamera;
	if (!camera) return undefined;
	const look = flatten(camera.CFrame.LookVector);
	if (isFirstPerson(camera) || input.GetLastInputType() === Enum.UserInputType.Touch) return look;
	const mouse = input.GetMouseLocation();
	const ray = camera.ViewportPointToRay(mouse.X, mouse.Y);
	if (math.abs(ray.Direction.Y) < 0.01) return look;
	const distance = (root.Position.Y - ray.Origin.Y) / ray.Direction.Y;
	// Com o ponteiro acima do horizonte, vale a direção horizontal do raio.
	if (distance <= 0) return flatten(ray.Direction) ?? look;
	return flatten(ray.Origin.add(ray.Direction.mul(distance)).sub(root.Position)) ?? look;
}

function playSound(id: string, volume: number, speed: number) {
	const sound = new Instance("Sound");
	sound.SoundId = id;
	sound.Volume = volume;
	sound.PlaybackSpeed = speed;
	sound.Parent = soundService;
	sound.Play();
	debris.AddItem(sound, 3);
}

function effectPart(size: Vector3, cframe: CFrame, color: Color3): Part {
	const part = new Instance("Part");
	part.Anchored = true;
	part.CanCollide = false;
	part.CanQuery = false;
	part.CanTouch = false;
	part.CastShadow = false;
	part.Material = Enum.Material.Neon;
	part.Color = color;
	part.Size = size;
	part.CFrame = cframe;
	part.Parent = workspace;
	return part;
}

function fade(part: Part, seconds: number) {
	tweens.Create(part, new TweenInfo(seconds), { Transparency: 1 }).Play();
	debris.AddItem(part, seconds + 0.05);
}

/** Efeito local. O dano depende da resposta do servidor à mesma geometria. */
function showAttack(root: BasePart, aim: Flat, id: PlayerAttackId) {
	const attack = PLAYER_ATTACKS[id];
	const base = CFrame.lookAt(root.Position, root.Position.add(new Vector3(aim.x, 0, aim.z)));
	if (attack.shape !== "arc") {
		fade(effectPart(new Vector3(0.9, 0.9, attack.range), base.mul(new CFrame(0, 0, -attack.range / 2)), theme.cyan), 0.25);
		return;
	}
	const slices = 7;
	for (let i = 0; i < slices; i++) {
		const turn = CFrame.Angles(0, attack.halfAngle - (attack.halfAngle * 2 * (i + 0.5)) / slices, 0);
		// As fatias surgem em sequência, para o arco parecer varrido.
		task.delay(i * 0.015, () => {
			const size = new Vector3(0.3, 0.3, attack.range * 0.7);
			fade(effectPart(size, base.mul(turn).mul(new CFrame(0, 0, -attack.range * 0.6)), theme.cyan), 0.14);
		});
	}
}

const RAISE_SECONDS = 0.08;
const LOWER_SECONDS = 0.2;

/** Levanta e baixa o braço. Soma-se à animação em curso. */
function swingArm(angle: number) {
	const character = player.Character;
	const shoulder = character && findShoulder(character);
	if (!shoulder) return;
	let elapsed = 0;
	const connection = runService.RenderStepped.Connect((delta) => {
		elapsed += delta;
		const done = elapsed >= RAISE_SECONDS + LOWER_SECONDS || !shoulder.isAlive();
		if (done) connection.Disconnect();
		if (!shoulder.isAlive()) return;
		const raised = elapsed < RAISE_SECONDS ? elapsed / RAISE_SECONDS : 1 - (elapsed - RAISE_SECONDS) / LOWER_SECONDS;
		shoulder.lift(done ? 0 : angle * raised);
	});
}

function dash(root: BasePart, direction: Flat) {
	const scale = player.GetAttribute(SPEED_SCALE);
	const speed = PLAYER_COMBAT.dodgeSpeed * (typeIs(scale, "number") ? scale : 1);
	let left = PLAYER_COMBAT.dodgeSeconds;
	const connection = runService.Heartbeat.Connect((delta) => {
		left -= delta;
		if (left <= 0 || root.Parent === undefined) return connection.Disconnect();
		root.AssemblyLinearVelocity = new Vector3(direction.x * speed, root.AssemblyLinearVelocity.Y, direction.z * speed);
	});
}

function showDamageNumber(position: Vector3, amount: number, color: Color3, size: number) {
	const anchor = effectPart(new Vector3(0.2, 0.2, 0.2), new CFrame(position), color);
	anchor.Transparency = 1;
	const gui = new Instance("BillboardGui");
	gui.Size = UDim2.fromOffset(120, 40);
	gui.AlwaysOnTop = true;
	gui.StudsOffset = new Vector3(math.random() * 2 - 1, 1.5, 0);
	gui.Parent = anchor;
	const text = new Instance("TextLabel");
	text.BackgroundTransparency = 1;
	text.Size = UDim2.fromScale(1, 1);
	text.Font = Enum.Font.GothamBold;
	text.Text = `${math.floor(amount + 0.5)}`;
	text.TextSize = size;
	text.TextColor3 = color;
	text.TextStrokeTransparency = 0.3;
	text.Parent = gui;
	const motion = new TweenInfo(0.7, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);
	tweens.Create(gui, motion, { StudsOffset: gui.StudsOffset.add(new Vector3(0, 3, 0)) }).Play();
	tweens.Create(text, new TweenInfo(0.7, Enum.EasingStyle.Quad, Enum.EasingDirection.In), { TextTransparency: 1, TextStrokeTransparency: 1 }).Play();
	debris.AddItem(anchor, 0.8);
}

function flash(target: Model | undefined, color: Color3) {
	if (!target) return;
	const highlight = new Instance("Highlight");
	highlight.FillColor = color;
	highlight.OutlineColor = color;
	highlight.FillTransparency = 0.2;
	highlight.Adornee = target;
	highlight.Parent = workspace;
	tweens.Create(highlight, new TweenInfo(0.18), { FillTransparency: 1, OutlineTransparency: 1 }).Play();
	debris.AddItem(highlight, 0.25);
}

/** Bordas vermelhas que somem aos poucos. */
function mountVignette(gui: ScreenGui) {
	const sides: ReadonlyArray<{ size: UDim2; position: UDim2; rotation: number }> = [
		{ size: UDim2.fromScale(1, 0.25), position: UDim2.fromScale(0, 0), rotation: 90 },
		{ size: UDim2.fromScale(1, 0.25), position: UDim2.fromScale(0, 0.75), rotation: 270 },
		{ size: UDim2.fromScale(0.2, 1), position: UDim2.fromScale(0, 0), rotation: 0 },
		{ size: UDim2.fromScale(0.2, 1), position: UDim2.fromScale(0.8, 0), rotation: 180 },
	];
	const frames = sides.map((side) => {
		const frame = new Instance("Frame");
		frame.Name = "Dano";
		frame.Active = false;
		frame.BorderSizePixel = 0;
		frame.BackgroundTransparency = 1;
		frame.Position = side.position;
		frame.Size = side.size;
		frame.ZIndex = 0;
		const gradient = new Instance("UIGradient");
		gradient.Rotation = side.rotation;
		gradient.Transparency = new NumberSequence(0, 1);
		gradient.Parent = frame;
		frame.Parent = gui;
		return frame;
	});
	return (color: Color3, strength: number) => {
		for (const frame of frames) {
			frame.BackgroundColor3 = color;
			frame.BackgroundTransparency = 1 - strength;
			tweens.Create(frame, new TweenInfo(0.6), { BackgroundTransparency: 1 }).Play();
		}
	};
}

/** Tremor aplicado depois da câmera padrão, sem alterar a mira dela no quadro seguinte. */
function mountShake() {
	let strength = 0;
	runService.BindToRenderStep("GenesisShake", Enum.RenderPriority.Camera.Value + 1, (delta) => {
		const camera = workspace.CurrentCamera;
		if (strength < 0.005 || !camera) return;
		const jitter = () => (math.random() - 0.5) * strength;
		camera.CFrame = camera.CFrame.mul(new CFrame(jitter(), jitter(), 0)).mul(CFrame.Angles(0, 0, jitter() * 0.05));
		strength *= math.exp(-SHAKE_DECAY * delta);
	});
	return (amount: number) => {
		strength = math.min(1.2, strength + amount);
	};
}

function meter(parent: Frame, name: string, y: number, color: Color3): Frame {
	label(parent, name, UDim2.fromOffset(12, y), UDim2.fromOffset(90, 16), 12, Enum.Font.GothamMedium);
	const track = new Instance("Frame");
	track.BackgroundColor3 = theme.group;
	track.BorderSizePixel = 0;
	track.Position = UDim2.fromOffset(106, y + 3);
	track.Size = UDim2.fromOffset(220, 10);
	track.Parent = parent;
	const fill = new Instance("Frame");
	fill.BackgroundColor3 = color;
	fill.BorderSizePixel = 0;
	fill.Size = UDim2.fromScale(1, 1);
	fill.Parent = track;
	return fill;
}

export function mountCombat(gui: ScreenGui) {
	const folder = replicatedStorage.WaitForChild(REMOTES_FOLDER);
	const commandRemote = folder.WaitForChild(COMBAT_REMOTE) as RemoteEvent<(command: CombatCommand) => void>;
	const syncRemote = folder.WaitForChild(COMBAT_SYNC_REMOTE) as RemoteEvent<(state: FighterState) => void>;
	const fxRemote = folder.WaitForChild(COMBAT_FX_REMOTE) as RemoteEvent<(fx: CombatFx) => void>;

	let fighter = new Fighter();
	let active = false;
	const showVignette = mountVignette(gui);
	const shake = mountShake();

	const frame = panel(gui, "Combate");
	frame.AnchorPoint = new Vector2(0.5, 1);
	frame.Position = new UDim2(0.5, 0, 1, -14);
	frame.Size = UDim2.fromOffset(340, 116);
	frame.Visible = false;
	scaleToFit(frame, 500);
	const health = meter(frame, "Vida", 10, theme.invalid);
	const stamina = meter(frame, "Resistência", 32, theme.valid);
	const shield = label(frame, "", UDim2.fromOffset(232, 8), UDim2.fromOffset(94, 16), 12, Enum.Font.GothamBold, theme.cyan);
	shield.TextXAlignment = Enum.TextXAlignment.Right;
	shield.ZIndex = 2;

	function attack(id: PlayerAttackId) {
		const root = rootPart();
		const humanoid = player.Character?.FindFirstChildOfClass("Humanoid");
		if (!active || !root || !humanoid || humanoid.Health <= 0) return;
		const aim = readAim(root);
		if (!aim || !fighter.attack(id, os.clock())) return;
		root.CFrame = CFrame.lookAt(root.Position, root.Position.add(new Vector3(aim.x, 0, aim.z)));
		commandRemote.FireServer({ kind: id, x: aim.x, z: aim.z });
		showAttack(root, aim, id);
		swingArm(id === "primary" ? math.rad(95) : math.rad(80));
		playSound(SOUND.swing, 0.35, id === "primary" ? 1.5 : 0.8);
		shake(id === "primary" ? 0.08 : 0.25);
	}

	function dodge() {
		const root = rootPart();
		const humanoid = player.Character?.FindFirstChildOfClass("Humanoid");
		if (!active || !root || !humanoid || humanoid.Health <= 0) return;
		const direction = flatten(humanoid.MoveDirection) ?? flatten(root.CFrame.LookVector);
		if (!direction || !fighter.dodge(os.clock())) return;
		commandRemote.FireServer({ kind: "dodge", x: direction.x, z: direction.z });
		dash(root, direction);
		playSound(SOUND.swing, 0.3, 2);
		const trail = effectPart(new Vector3(1.6, 3.6, 0.8), root.CFrame, theme.cyan);
		trail.Transparency = 0.6;
		fade(trail, 0.35);
	}

	const actions: ReadonlyArray<{ key: "primary" | "secondary" | "dodge"; name: string; run: () => void }> = [
		{ key: "primary", name: "Clique  Arco", run: () => attack("primary") },
		{ key: "secondary", name: "F  Descarga", run: () => attack("secondary") },
		{ key: "dodge", name: "Q  Esquiva", run: dodge },
	];
	const buttons = actions.map((action, index) => {
		const instance = button(frame, action.key, action.name, UDim2.fromOffset(100, 46), action.run);
		instance.Position = UDim2.fromOffset(12 + index * 108, 60);
		return { key: action.key, name: action.name, instance };
	});

	input.InputBegan.Connect((event, processed) => {
		if (processed || !active) return;
		if (event.UserInputType === Enum.UserInputType.MouseButton1) attack("primary");
		else if (event.KeyCode === Enum.KeyCode.F) attack("secondary");
		else if (event.KeyCode === Enum.KeyCode.Q) dodge();
	});

	syncRemote.OnClientEvent.Connect((state) => fighter.apply(state, os.clock()));
	fxRemote.OnClientEvent.Connect((fx) => {
		if (fx.kind === "hit") {
			showDamageNumber(fx.position, fx.amount, fx.killed ? theme.orange : theme.text, fx.killed ? 30 : 24);
			flash(fx.target, fx.killed ? theme.orange : theme.text);
			playSound(fx.killed ? SOUND.kill : SOUND.hit, fx.killed ? 0.4 : 0.5, fx.killed ? 1.3 : 1.2);
			shake(fx.killed ? 0.5 : 0.15);
		} else {
			showVignette(fx.shielded ? theme.cyan : theme.invalid, fx.shielded ? 0.4 : 0.75);
			shake(0.2 + fx.amount / 60);
			if (!fx.shielded) playSound(SOUND.hurt, 0.4, 1);
		}
	});

	runService.RenderStepped.Connect(() => {
		if (!active) return;
		const state = fighter.state(os.clock());
		const humanoid = player.Character?.FindFirstChildOfClass("Humanoid");
		const life = humanoid && humanoid.MaxHealth > 0 ? humanoid.Health / humanoid.MaxHealth : 0;
		health.Size = UDim2.fromScale(math.clamp(life, 0, 1), 1);
		stamina.Size = UDim2.fromScale(state.stamina / PLAYER_COMBAT.stamina, 1);
		shield.Text = state.shield > 0 ? `+${math.ceil(state.shield)} escudo` : "";
		for (const { key, name, instance } of buttons) {
			const wait = state[key];
			instance.Text = wait > 0.05 && key !== "primary" ? `${name}\n${string.format("%.1f", wait)} s` : name;
			instance.BackgroundColor3 = wait > 0 ? theme.surface : theme.group;
		}
	});

	function refresh() {
		active = player.GetAttribute(IN_ENCOUNTER) === true;
		frame.Visible = active;
		if (active) fighter = new Fighter();
	}
	player.GetAttributeChangedSignal(IN_ENCOUNTER).Connect(refresh);
	refresh();
}
