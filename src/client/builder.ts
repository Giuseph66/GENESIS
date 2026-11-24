import { COST_RESOURCE, findMachine, MACHINES, MachineType } from "../shared/catalog";
import {
	BUILD_REACH,
	CELL_SIZE,
	isInsideGrid,
	isReserved,
	occupiedCells,
	Placement,
	placementAt,
	placementCenter,
} from "../shared/grid";
import {
	Reason,
	STRUCTURE_CX,
	STRUCTURE_CZ,
	STRUCTURE_ID,
	STRUCTURE_MACHINE,
	STRUCTURE_ROTATION,
	STRUCTURES_FOLDER,
} from "../shared/protocol";
import { getState, onState, sendBuild, sendRemove } from "./connection";
import { reasonText } from "./hud";
import { button, label, panel, scaleToFit, theme } from "./ui";

const players = game.GetService("Players");
const workspace = game.GetService("Workspace");
const runService = game.GetService("RunService");
const input = game.GetService("UserInputService");

const DIGITS: ReadonlyArray<Enum.KeyCode> = [
	Enum.KeyCode.One,
	Enum.KeyCode.Two,
	Enum.KeyCode.Three,
	Enum.KeyCode.Four,
	Enum.KeyCode.Five,
	Enum.KeyCode.Six,
];

type Mode = { kind: "idle" } | { kind: "build"; machine: MachineType } | { kind: "remove" };

function attribute(model: Instance, name: string): number | undefined {
	const value = model.GetAttribute(name);
	return typeIs(value, "number") ? value : undefined;
}

/** Previsão local. O servidor confere tudo de novo. */
function predict(machine: MachineType, placement: Placement): Reason {
	const state = getState();
	if (!state || !state.echoOnline) return "ECHO_OFFLINE";
	if (!isInsideGrid(machine, placement)) return "OUT_OF_BOUNDS";
	if (isReserved(machine, placement)) return "RESERVED_AREA";

	const wanted = new Set(occupiedCells(machine, placement));
	for (const model of workspace.FindFirstChild(STRUCTURES_FOLDER)?.GetChildren() ?? []) {
		const other = findMachine(model.GetAttribute(STRUCTURE_MACHINE));
		const cx = attribute(model, STRUCTURE_CX);
		const cz = attribute(model, STRUCTURE_CZ);
		const rotation = attribute(model, STRUCTURE_ROTATION);
		if (!other || cx === undefined || cz === undefined || rotation === undefined) continue;
		if (occupiedCells(other, { cx, cz, rotation }).some((cell) => wanted.has(cell))) return "CELL_OCCUPIED";
	}

	const root = players.LocalPlayer.Character?.FindFirstChild("HumanoidRootPart");
	if (!root?.IsA("BasePart") || root.Position.sub(placementCenter(machine, placement)).Magnitude > BUILD_REACH) {
		return "TOO_FAR";
	}
	return state.inventory[COST_RESOURCE] < machine.cost ? "INSUFFICIENT_ITEMS" : "OK";
}

/** Ponto do piso sob a tela. O piso da área construível fica em Y = 0. */
function floorPoint(screen: Vector2): Vector3 | undefined {
	const ray = workspace.CurrentCamera?.ViewportPointToRay(screen.X, screen.Y);
	if (!ray || ray.Direction.Y >= -0.01) return undefined;
	return ray.Origin.add(ray.Direction.mul(-ray.Origin.Y / ray.Direction.Y));
}

function structureAt(screen: Vector2): Model | undefined {
	const ray = workspace.CurrentCamera?.ViewportPointToRay(screen.X, screen.Y);
	const folder = workspace.FindFirstChild(STRUCTURES_FOLDER);
	if (!ray || !folder) return undefined;
	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Include;
	params.FilterDescendantsInstances = [folder];
	const model = workspace.Raycast(ray.Origin, ray.Direction.mul(300), params)?.Instance.FindFirstAncestorOfClass("Model");
	return model && attribute(model, STRUCTURE_ID) !== undefined ? model : undefined;
}

export function mountBuilder(gui: ScreenGui) {
	let mode: Mode = { kind: "idle" };
	let rotation = 0;
	let placement: Placement | undefined;
	let target: Model | undefined;
	/** No toque, a prévia fica onde o jogador tocou até ele confirmar. */
	let touchPoint: Vector2 | undefined;

	const ghost = new Instance("Part");
	ghost.Name = "Prévia";
	ghost.Anchored = true;
	ghost.CanCollide = false;
	ghost.CanQuery = false;
	ghost.CanTouch = false;
	ghost.CastShadow = false;
	ghost.Material = Enum.Material.ForceField;
	ghost.Transparency = 0.3;
	const front = ghost.Clone();
	front.Name = "Frente";
	front.Material = Enum.Material.Neon;
	front.Transparency = 0;
	const highlight = new Instance("Highlight");
	highlight.FillColor = theme.invalid;
	highlight.OutlineColor = theme.invalid;
	highlight.Enabled = false;
	highlight.Parent = gui;

	const bar = panel(gui, "Construcao");
	bar.AnchorPoint = new Vector2(0.5, 1);
	bar.Position = new UDim2(0.5, 0, 1, -14);
	bar.Size = UDim2.fromOffset(700, 66);
	scaleToFit(bar, 740);
	const layout = new Instance("UIListLayout");
	layout.FillDirection = Enum.FillDirection.Horizontal;
	layout.HorizontalAlignment = Enum.HorizontalAlignment.Center;
	layout.VerticalAlignment = Enum.VerticalAlignment.Center;
	layout.Padding = new UDim(0, 6);
	layout.SortOrder = Enum.SortOrder.LayoutOrder;
	layout.Parent = bar;

	const actions = panel(gui, "Acoes");
	actions.AnchorPoint = new Vector2(0.5, 1);
	actions.Position = new UDim2(0.5, 0, 1, -88);
	actions.Size = UDim2.fromOffset(560, 48);
	actions.Visible = false;
	scaleToFit(actions, 740);
	const status = label(actions, "", UDim2.fromOffset(12, 0), new UDim2(0, 220, 1, 0), 13, Enum.Font.GothamMedium);

	function tint(instance: TextButton, selected: boolean) {
		instance.BackgroundColor3 = selected ? theme.orange : theme.group;
		instance.TextColor3 = selected ? theme.surface : theme.text;
	}

	const choices = new Array<{ machine: MachineType; button: TextButton }>();
	let removeButton: TextButton | undefined;

	function setMode(nextMode: Mode) {
		mode = nextMode;
		placement = undefined;
		target = undefined;
		touchPoint = undefined;
		ghost.Parent = undefined;
		front.Parent = undefined;
		highlight.Enabled = false;
		actions.Visible = mode.kind !== "idle";
		for (const choice of choices) tint(choice.button, nextMode.kind === "build" && nextMode.machine === choice.machine);
		if (removeButton) tint(removeButton, mode.kind === "remove");
	}

	function chooseMachine(machine: MachineType) {
		setMode(mode.kind === "build" && mode.machine === machine ? { kind: "idle" } : { kind: "build", machine });
	}

	function toggleRemove() {
		setMode(mode.kind === "remove" ? { kind: "idle" } : { kind: "remove" });
	}

	function rotate() {
		if (mode.kind === "build") rotation = (rotation + 1) % 4;
	}

	function confirm() {
		if (mode.kind === "build" && placement) {
			sendBuild({ machine: mode.machine.id, cx: placement.cx, cz: placement.cz, rotation: placement.rotation });
		} else if (mode.kind === "remove" && target) {
			const id = attribute(target, STRUCTURE_ID);
			if (id !== undefined) sendRemove(id);
		}
	}

	MACHINES.forEach((machine, index) => {
		const content = `${index + 1}  ${machine.name}\n${machine.cost} ferro`;
		const choice = button(bar, machine.id, content, UDim2.fromOffset(92, 52), () => chooseMachine(machine));
		choice.LayoutOrder = index;
		choices.push({ machine, button: choice });
	});
	removeButton = button(bar, "remover", "X  Remover", UDim2.fromOffset(92, 52), toggleRemove);
	removeButton.LayoutOrder = 99;

	const place = (instance: TextButton, x: number) => {
		instance.AnchorPoint = new Vector2(0, 0.5);
		instance.Position = new UDim2(0, x, 0.5, 0);
	};
	place(button(actions, "girar", "R  Girar", UDim2.fromOffset(92, 36), rotate), 244);
	place(button(actions, "confirmar", "Confirmar", UDim2.fromOffset(104, 36), confirm), 342);
	place(button(actions, "cancelar", "Q  Cancelar", UDim2.fromOffset(98, 36), () => setMode({ kind: "idle" })), 452);

	input.InputBegan.Connect((event, processed) => {
		if (processed) return;
		const digit = DIGITS.indexOf(event.KeyCode);
		if (digit >= 0 && digit < MACHINES.size()) chooseMachine(MACHINES[digit]);
		else if (event.KeyCode === Enum.KeyCode.R) rotate();
		else if (event.KeyCode === Enum.KeyCode.X) toggleRemove();
		else if (event.KeyCode === Enum.KeyCode.Q) setMode({ kind: "idle" });
		else if (event.UserInputType === Enum.UserInputType.MouseButton1) confirm();
	});
	input.TouchTapInWorld.Connect((position, processed) => {
		if (!processed && mode.kind !== "idle") touchPoint = position;
	});

	function pointer(): Vector2 | undefined {
		if (input.GetLastInputType() === Enum.UserInputType.Touch || touchPoint) return touchPoint;
		return input.GetMouseLocation();
	}

	function showGhost(machine: MachineType, current: Placement) {
		const reason = predict(machine, current);
		const color = reason === "OK" ? theme.valid : theme.invalid;
		const origin = new CFrame(placementCenter(machine, current)).mul(CFrame.Angles(0, (-current.rotation * math.pi) / 2, 0));
		ghost.Size = new Vector3(machine.width * CELL_SIZE, machine.height, machine.depth * CELL_SIZE);
		ghost.CFrame = origin.mul(new CFrame(0, machine.height / 2, 0));
		ghost.Color = color;
		front.Size = new Vector3(machine.width * CELL_SIZE * 0.6, 0.3, 0.8);
		front.CFrame = origin.mul(new CFrame(0, machine.height + 0.2, (-machine.depth * CELL_SIZE) / 2 + 0.4));
		front.Color = color;
		ghost.Parent = workspace.CurrentCamera;
		front.Parent = workspace.CurrentCamera;
		status.Text = reason === "OK" ? `✓ ${machine.name}: pronto para construir` : `✕ ${reasonText(reason)}`;
		status.TextColor3 = color;
	}

	runService.RenderStepped.Connect(() => {
		if (mode.kind === "idle") return;
		const screen = pointer();
		if (mode.kind === "remove") {
			target = screen && structureAt(screen);
			highlight.Adornee = target;
			highlight.Enabled = target !== undefined;
			status.Text = target ? `Remover ${target.Name} e recuperar o custo` : "Aponte para uma construção";
			status.TextColor3 = theme.text;
			return;
		}

		const point = screen && floorPoint(screen);
		placement = point && placementAt(mode.machine, point, rotation);
		if (placement) {
			showGhost(mode.machine, placement);
		} else {
			ghost.Parent = undefined;
			front.Parent = undefined;
			status.Text = "Aponte para o piso";
			status.TextColor3 = theme.text;
		}
	});

	onState((state) => {
		bar.Visible = state.echoOnline;
	});
}
