import { BUILDABLE, COST_ITEM, MachineType } from "../shared/catalog";
import { IN_ENCOUNTER } from "../shared/combat";
import {
	BUILD_REACH,
	isInsideGrid,
	isOnVein,
	isReserved,
	occupiedCells,
	Placement,
	placementAt,
	placementCenter,
} from "../shared/grid";
import { DIRECTION_NAMES, hasOutput } from "../shared/ports";
import { Reason, STRUCTURE_OWNER } from "../shared/protocol";
import { aimPoint } from "./camera";
import { getState, onState, send } from "./connection";
import { enterDrone, leaveDrone, zoomDrone } from "./drone";
import { createGrid, Ghost } from "./ghost";
import { reasonText } from "./hud";
import { mountInspector } from "./inspector";
import { playSound } from "./sounds";
import { button, keyBadge, keyButton, label, panel, scaleToFit, setSelected, swatch, theme } from "./ui";
import { floorPoint, numberAttribute, SeenStructure, seenStructures, structureAt } from "./world";

const players = game.GetService("Players");
const runService = game.GetService("RunService");
const input = game.GetService("UserInputService");

const player = players.LocalPlayer;
const DIGITS: ReadonlyArray<Enum.KeyCode> = [
	Enum.KeyCode.One,
	Enum.KeyCode.Two,
	Enum.KeyCode.Three,
	Enum.KeyCode.Four,
	Enum.KeyCode.Five,
	Enum.KeyCode.Six,
];
const MAX_LINE = 24;
/** Um pouco abaixo do limite de comandos do servidor. */
const SEND_INTERVAL = 0.13;
const ZOOM_STEP = 0.12;
/** Longe disto do posto, o drone não alcança o platô. */
const BASE_DISTANCE = 150;

type Mode =
	/** A pé, fora da construção. */
	| { kind: "off" }
	/** No drone, sem nada escolhido. */
	| { kind: "idle" }
	| { kind: "build"; machine: MachineType }
	| { kind: "pick"; action: "move" | "remove" }
	| { kind: "move"; structure: SeenStructure };

interface Plan {
	readonly placement: Placement;
	readonly reason: Reason;
}

/** Previsão local. O servidor confere tudo de novo. */
function predict(machine: MachineType, placement: Placement, taken: ReadonlySet<string>, iron: number, moving: boolean): Reason {
	const state = getState();
	if (!state || (moving ? !state.grants.remove : !state.grants.build)) return "NOT_AUTHORIZED";
	if (!isInsideGrid(machine, placement)) return "OUT_OF_BOUNDS";
	if (isReserved(machine, placement)) return "RESERVED_AREA";
	if (occupiedCells(machine, placement).some((cell) => taken.has(cell))) return "CELL_OCCUPIED";
	if (machine.needsVein && !isOnVein(machine, placement)) return "NO_VEIN";
	const root = player.Character?.FindFirstChild("HumanoidRootPart");
	if (!root?.IsA("BasePart") || root.Position.sub(placementCenter(machine, placement)).Magnitude > BUILD_REACH) return "TOO_FAR";
	return !moving && iron < machine.cost ? "INSUFFICIENT_ITEMS" : "OK";
}

/** Caminho em L entre duas células. Cada esteira aponta para a seguinte. */
function beltLine(from: Placement, to: Placement, rotation: number): Array<Placement> {
	const cells = [{ cx: from.cx, cz: from.cz }];
	const spanX = to.cx - from.cx;
	const spanZ = to.cz - from.cz;
	const walk = (count: number, stepX: number, stepZ: number) => {
		for (let i = 0; i < count && cells.size() < MAX_LINE; i++) {
			const last = cells[cells.size() - 1];
			cells.push({ cx: last.cx + stepX, cz: last.cz + stepZ });
		}
	};
	const alongX = () => walk(math.abs(spanX), math.sign(spanX), 0);
	const alongZ = () => walk(math.abs(spanZ), 0, math.sign(spanZ));
	if (math.abs(spanX) >= math.abs(spanZ)) {
		alongX();
		alongZ();
	} else {
		alongZ();
		alongX();
	}
	let facing = rotation;
	return cells.map((cell, index) => {
		const following = cells[index + 1];
		if (following) {
			const stepX = following.cx - cell.cx;
			const stepZ = following.cz - cell.cz;
			facing = stepX > 0 ? 1 : stepX < 0 ? 3 : stepZ > 0 ? 2 : 0;
		}
		return { cx: cell.cx, cz: cell.cz, rotation: facing };
	});
}

export function mountBuilder(gui: ScreenGui, showToast: (text: string) => void) {
	const inspector = mountInspector(gui);
	const showGrid = createGrid();
	const ghosts = new Array<Ghost>();
	let mode: Mode = { kind: "off" };
	let rotation = 0;
	let plans = new Array<Plan>();
	let target: SeenStructure | undefined;
	/** No toque, a prévia fica onde o jogador tocou até ele confirmar. */
	let touchPoint: Vector2 | undefined;
	let dragFrom: Placement | undefined;

	const highlight = new Instance("Highlight");
	highlight.Enabled = false;
	highlight.Parent = gui;

	const bar = panel(gui, "Construcao");
	bar.AnchorPoint = new Vector2(0.5, 1);
	bar.Position = new UDim2(0.5, 0, 1, -14);
	bar.Size = UDim2.fromOffset(820, 72);
	bar.Visible = false;
	scaleToFit(bar, 860);
	const layout = new Instance("UIListLayout");
	layout.FillDirection = Enum.FillDirection.Horizontal;
	layout.HorizontalAlignment = Enum.HorizontalAlignment.Center;
	layout.VerticalAlignment = Enum.VerticalAlignment.Center;
	layout.Padding = new UDim(0, 6);
	layout.SortOrder = Enum.SortOrder.LayoutOrder;
	layout.Parent = bar;

	const actions = panel(gui, "Acoes");
	actions.AnchorPoint = new Vector2(0.5, 1);
	actions.Size = UDim2.fromOffset(700, 76);
	actions.Position = new UDim2(0.5, 0, 1, -96);
	actions.Visible = false;
	scaleToFit(actions, 740);
	const status = label(actions, "", UDim2.fromOffset(14, 4), UDim2.fromOffset(672, 22), 15, Enum.Font.GothamBold);
	const tip = label(actions, "", UDim2.fromOffset(14, 28), UDim2.fromOffset(330, 42), 12, Enum.Font.Gotham, theme.muted);
	tip.TextYAlignment = Enum.TextYAlignment.Top;

	const choices = new Array<{ instance: TextButton; isActive: (mode: Mode) => boolean }>();

	function hideGhosts(from = 0) {
		for (let i = from; i < ghosts.size(); i++) ghosts[i].hide();
	}

	function tipFor(current: Mode): string {
		if (current.kind === "build" && current.machine.id === "belt") return "Clique e arraste para fazer uma linha.\nScroll gira. Ctrl + scroll aproxima.";
		if (current.kind === "build" || current.kind === "move") return "Clique para colocar. Scroll ou R gira.\nCtrl + scroll aproxima. Botão direito gira a vista.";
		if (current.kind === "pick") return "Clique na construção.\nScroll aproxima. WASD move o drone.";
		return "Escolha uma máquina abaixo ou clique em uma para abrir.\nWASD move. Botão direito gira. Scroll aproxima.";
	}

	function setMode(nextMode: Mode) {
		const wasOff = mode.kind === "off";
		mode = nextMode;
		plans = [];
		target = undefined;
		touchPoint = undefined;
		dragFrom = undefined;
		hideGhosts();
		highlight.Enabled = false;
		const isOpen = mode.kind !== "off";
		bar.Visible = isOpen;
		actions.Visible = isOpen;
		showGrid(isOpen);
		if (isOpen && wasOff) enterDrone();
		if (!isOpen && !wasOff) leaveDrone();
		if (mode.kind !== "idle" && mode.kind !== "off") inspector.close();
		tip.Text = tipFor(nextMode);
		if (nextMode.kind === "idle") {
			status.Text = "Modo construção";
			status.TextColor3 = theme.text;
		}
		for (const choice of choices) setSelected(choice.instance, choice.isActive(nextMode));
	}

	/** Motivo para não abrir o drone agora. */
	function blockedBy(): string | undefined {
		const state = getState();
		if (!state) return "Conectando…";
		if (state.role === "visitor") return reasonText("NOT_MEMBER");
		if (player.GetAttribute(IN_ENCOUNTER) === true) return "Termine a expedição antes de construir.";
		const root = player.Character?.FindFirstChild("HumanoidRootPart");
		if (!root?.IsA("BasePart") || root.Position.Magnitude > BASE_DISTANCE) return "Volte ao posto para construir.";
		return undefined;
	}

	function open(nextMode: Mode) {
		const problem = mode.kind === "off" ? blockedBy() : undefined;
		if (problem !== undefined) return showToast(problem);
		setMode(nextMode);
	}

	function toggle() {
		if (mode.kind === "off") open({ kind: "idle" });
		else setMode({ kind: "off" });
	}

	/** Um passo para trás: solta a escolha e, sem escolha, sai do drone. */
	function cancel() {
		if (mode.kind === "off") return;
		setMode(mode.kind === "idle" ? { kind: "off" } : { kind: "idle" });
	}

	function chooseMachine(machine: MachineType) {
		open(mode.kind === "build" && mode.machine === machine ? { kind: "idle" } : { kind: "build", machine });
	}

	function togglePick(action: "move" | "remove") {
		open(mode.kind === "pick" && mode.action === action ? { kind: "idle" } : { kind: "pick", action });
	}

	function rotate(turns: number) {
		if (mode.kind !== "build" && mode.kind !== "move") return;
		rotation = (rotation + turns + 4) % 4;
		playSound("click", 0.3, 1.4, 0.3);
	}

	function placeAll() {
		if (mode.kind !== "build") return;
		const machine = mode.machine.id;
		const valid = plans.filter((plan) => plan.reason === "OK");
		if (valid.size() === 0) {
			if (plans.size() > 0) showToast(reasonText(plans[0].reason));
			return;
		}
		playSound("land", 0.4, 1.2, 0.4);
		// Espaça o envio para caber no limite de comandos.
		valid.forEach((plan, index) => {
			const { cx, cz } = plan.placement;
			const facing = plan.placement.rotation;
			task.delay(index * SEND_INTERVAL, () => send({ kind: "build", machine, cx, cz, rotation: facing }));
		});
		// Emendar a próxima peça na mesma direção é o caso comum.
		rotation = valid[valid.size() - 1].placement.rotation;
	}

	function confirm() {
		if (mode.kind === "build") {
			placeAll();
		} else if (mode.kind === "move" && plans.size() > 0) {
			const { placement, reason } = plans[0];
			if (reason !== "OK") return showToast(reasonText(reason));
			send({ kind: "move", structureId: mode.structure.id, cx: placement.cx, cz: placement.cz, rotation: placement.rotation });
			setMode({ kind: "pick", action: "move" });
		} else if (mode.kind === "pick" && target) {
			if (mode.action === "remove") {
				send({ kind: "remove", structureId: target.id });
			} else {
				const structure = target;
				rotation = structure.placement.rotation;
				setMode({ kind: "move", structure });
			}
		}
	}

	function addChoice(instance: TextButton, order: number, isActive: (mode: Mode) => boolean) {
		instance.LayoutOrder = order;
		choices.push({ instance, isActive });
	}
	BUILDABLE.forEach((machine, index) => {
		const card = button(bar, machine.id, "", UDim2.fromOffset(104, 58), () => chooseMachine(machine));
		keyBadge(card, `${index + 1}`, UDim2.fromOffset(8, 16));
		swatch(card, machine.color, UDim2.fromOffset(84, 16), 12);
		label(card, machine.name, UDim2.fromOffset(8, 28), UDim2.fromOffset(92, 16), 13, Enum.Font.GothamMedium);
		label(card, `${machine.cost} ferro`, UDim2.fromOffset(8, 42), UDim2.fromOffset(92, 14), 11, Enum.Font.Gotham, theme.muted);
		const isActive = (current: Mode) => current.kind === "build" && current.machine === machine;
		addChoice(card, index, isActive);
	});
	const isMoving = (current: Mode) => current.kind === "move" || (current.kind === "pick" && current.action === "move");
	addChoice(keyButton(bar, "mover", "M", "Mover", UDim2.fromOffset(96, 58), () => togglePick("move")), 98, isMoving);
	const isRemoving = (current: Mode) => current.kind === "pick" && current.action === "remove";
	addChoice(keyButton(bar, "remover", "X", "Remover", UDim2.fromOffset(104, 58), () => togglePick("remove")), 99, isRemoving);

	const place = (instance: TextButton, x: number) => {
		instance.Position = UDim2.fromOffset(x, 30);
	};
	place(keyButton(actions, "girar", "R", "Girar", UDim2.fromOffset(76, 38), () => rotate(1)), 350);
	place(button(actions, "perto", "+", UDim2.fromOffset(38, 38), () => zoomDrone(-ZOOM_STEP * 2)), 432);
	place(button(actions, "longe", "−", UDim2.fromOffset(38, 38), () => zoomDrone(ZOOM_STEP * 2)), 474);
	place(button(actions, "confirmar", "Colocar", UDim2.fromOffset(76, 38), confirm), 518);
	place(keyButton(actions, "cancelar", "Q", "Voltar", UDim2.fromOffset(84, 38), cancel), 600);

	function inspect(screen: Vector2) {
		const structure = structureAt(screen);
		if (structure) inspector.open(structure);
		else inspector.close();
	}

	function pointer(): Vector2 | undefined {
		if (input.GetLastInputType() === Enum.UserInputType.Touch || touchPoint) return touchPoint;
		return aimPoint();
	}

	function pointed(machine: MachineType): Placement | undefined {
		const screen = pointer();
		const point = screen && floorPoint(screen);
		return point && placementAt(machine, point, rotation);
	}

	input.InputBegan.Connect((event, processed) => {
		if (processed) return;
		const digit = DIGITS.indexOf(event.KeyCode);
		if (player.GetAttribute(IN_ENCOUNTER) === true) return;
		if (digit >= 0 && digit < BUILDABLE.size()) chooseMachine(BUILDABLE[digit]);
		else if (event.KeyCode === Enum.KeyCode.B) toggle();
		else if (event.KeyCode === Enum.KeyCode.R) rotate(1);
		else if (event.KeyCode === Enum.KeyCode.M) togglePick("move");
		else if (event.KeyCode === Enum.KeyCode.X) togglePick("remove");
		else if (event.KeyCode === Enum.KeyCode.Q) cancel();
		else if (event.UserInputType === Enum.UserInputType.MouseButton1) {
			if (mode.kind === "off" || mode.kind === "idle") inspect(aimPoint());
			else if (mode.kind === "build" && mode.machine.id === "belt") dragFrom = pointed(mode.machine);
			else confirm();
		}
	});
	input.InputEnded.Connect((event) => {
		if (event.UserInputType !== Enum.UserInputType.MouseButton1 || !dragFrom) return;
		placeAll();
		dragFrom = undefined;
	});
	input.InputChanged.Connect((event, processed) => {
		if (processed || mode.kind === "off" || event.UserInputType !== Enum.UserInputType.MouseWheel) return;
		const direction = event.Position.Z > 0 ? 1 : -1;
		const wantsZoom = input.IsKeyDown(Enum.KeyCode.LeftControl) || input.IsKeyDown(Enum.KeyCode.RightControl);
		if (!wantsZoom && (mode.kind === "build" || mode.kind === "move")) rotate(direction);
		else zoomDrone(-direction * ZOOM_STEP);
	});
	input.TouchTapInWorld.Connect((position, processed) => {
		if (processed) return;
		if (mode.kind === "off" || mode.kind === "idle") inspect(position);
		else touchPoint = position;
	});

	function showTarget(action: "move" | "remove") {
		const screen = pointer();
		const found = screen && structureAt(screen);
		// Estruturas fixas do cenário têm dono zero.
		const isFixed = found && numberAttribute(found.model, STRUCTURE_OWNER) === 0;
		target = found && !isFixed && getState()?.grants.remove ? found : undefined;
		const color = action === "remove" ? theme.invalid : theme.cyan;
		highlight.FillColor = color;
		highlight.OutlineColor = color;
		highlight.Adornee = target?.model;
		highlight.Enabled = target !== undefined;
		status.TextColor3 = theme.text;
		if (!target) status.Text = found ? reasonText("NOT_AUTHORIZED") : "Aponte para uma construção";
		else if (action === "remove") status.Text = `Remover ${target.machine.name} e recuperar custo e itens`;
		else status.Text = `Mover ${target.machine.name}`;
	}

	function showPlans(machine: MachineType, moving: SeenStructure | undefined) {
		const current = pointed(machine);
		if (!current) {
			plans = [];
			hideGhosts();
			status.Text = "Aponte para o piso do posto";
			status.TextColor3 = theme.text;
			return;
		}
		const others = seenStructures().filter((other) => !moving || other.id !== moving.id);
		const taken = new Set<string>();
		for (const other of others) for (const cell of occupiedCells(other.machine, other.placement)) taken.add(cell);
		let iron = getState()?.inventory[COST_ITEM] ?? 0;
		const placements = dragFrom ? beltLine(dragFrom, current, rotation) : [current];
		plans = placements.map((placement) => {
			const reason = predict(machine, placement, taken, iron, moving !== undefined);
			if (reason === "OK") iron -= machine.cost;
			return { placement, reason };
		});
		plans.forEach((plan, index) => {
			if (!ghosts[index]) ghosts[index] = new Ghost();
			const ports = { entry: index === 0, exit: index === plans.size() - 1 };
			ghosts[index].show(machine, plan.placement, plan.reason === "OK", others, ports);
		});
		hideGhosts(plans.size());

		const valid = plans.filter((plan) => plan.reason === "OK").size();
		const problem = plans.find((plan) => plan.reason !== "OK");
		const facing = plans[plans.size() - 1].placement.rotation;
		const direction = hasOutput(machine) ? ` · saída para o ${DIRECTION_NAMES[facing]}` : "";
		const amount = plans.size() > 1 ? `${valid} × ` : "";
		if (problem && valid === 0) {
			status.Text = `X ${machine.name}: ${reasonText(problem.reason)}${direction}`;
			status.TextColor3 = theme.invalid;
		} else {
			const cost = moving ? "" : ` · ${valid * machine.cost} ferro`;
			status.Text = `${amount}${machine.name}${cost}${direction}`;
			status.TextColor3 = problem ? theme.orange : theme.valid;
		}
	}

	runService.RenderStepped.Connect(() => {
		if (mode.kind === "off" || mode.kind === "idle") return;
		if (mode.kind === "pick") return showTarget(mode.action);
		if (mode.kind === "move") showPlans(mode.structure.machine, mode.structure);
		else showPlans(mode.machine, undefined);
	});

	function refreshAvailability() {
		const inEncounter = player.GetAttribute(IN_ENCOUNTER) === true;
		const visiting = getState()?.role === "visitor";
		if (inEncounter) inspector.close();
		if ((inEncounter || visiting) && mode.kind !== "off") setMode({ kind: "off" });
	}
	onState(refreshAvailability);
	player.GetAttributeChangedSignal(IN_ENCOUNTER).Connect(refreshAvailability);
	// Ao renascer, a câmera volta ao personagem novo.
	player.CharacterAdded.Connect(() => {
		if (mode.kind !== "off") setMode({ kind: "off" });
	});
	return { isBusy: () => mode.kind !== "off", toggle };
}
