import type { MachineType } from "../shared/catalog";
import { CELL_SIZE, cellKey, frontCells, HALF_EXTENT, occupiedCells, Placement, placementCFrame } from "../shared/grid";
import { acceptsFrom, hasInput, hasOutput } from "../shared/ports";
import { theme } from "./ui";
import { SeenStructure } from "./world";

const workspace = game.GetService("Workspace");

const PORT_WAITING = theme.orange;
const PORT_LINKED = theme.valid;
const INPUT_COLOR = theme.cyan;
/** Na face superior, o alto do texto aponta para -X. Isto o leva para -Z, a frente da máquina. */
const PORT_TURN = CFrame.Angles(0, -math.pi / 2, 0);

function ghostPart(name: string): Part {
	const part = new Instance("Part");
	part.Name = name;
	part.Anchored = true;
	part.CanCollide = false;
	part.CanQuery = false;
	part.CanTouch = false;
	part.CastShadow = false;
	return part;
}

interface Port {
	readonly part: Part;
	readonly text: TextLabel;
}

function createPort(): Port {
	const part = ghostPart("Porta");
	part.Size = new Vector3(3, 0.1, 5.4);
	part.Transparency = 0.2;
	part.Material = Enum.Material.SmoothPlastic;
	const gui = new Instance("SurfaceGui");
	gui.Face = Enum.NormalId.Top;
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud;
	gui.PixelsPerStud = 40;
	gui.LightInfluence = 0;
	gui.Parent = part;
	const text = new Instance("TextLabel");
	text.BackgroundTransparency = 1;
	text.Size = UDim2.fromScale(1, 1);
	text.Font = Enum.Font.GothamBold;
	text.TextScaled = true;
	text.TextColor3 = theme.surface;
	text.Parent = gui;
	return { part, text };
}

/** Numa linha de esteiras, só a primeira mostra a entrada e só a última, a saída. */
export interface ShownPorts {
	readonly entry: boolean;
	readonly exit: boolean;
}

/** Prévia de uma máquina, com as portas escritas no chão. */
export class Ghost {
	private readonly body = ghostPart("Prévia");
	private readonly exit = createPort();
	private readonly entry = createPort();

	constructor() {
		this.body.Material = Enum.Material.ForceField;
		this.body.Transparency = 0.2;
	}

	public show(machine: MachineType, placement: Placement, valid: boolean, others: Array<SeenStructure>, ports: ShownPorts) {
		const origin = placementCFrame(machine, placement);
		const depth = machine.depth * CELL_SIZE;
		this.body.Size = new Vector3(machine.width * CELL_SIZE - 0.2, machine.height, depth - 0.2);
		this.body.CFrame = origin.mul(new CFrame(0, machine.height / 2, 0));
		this.body.Color = valid ? theme.valid : theme.invalid;
		this.body.Parent = workspace.CurrentCamera;

		const outputs = ports.exit && hasOutput(machine);
		if (outputs) {
			const linked = isOutputLinked(machine, placement, others);
			this.exit.part.CFrame = origin.mul(new CFrame(0, 0.25, -depth / 2 - 1.8)).mul(PORT_TURN);
			this.exit.part.Color = linked ? PORT_LINKED : PORT_WAITING;
			this.exit.text.Text = linked ? "▲ SAÍDA LIGADA" : "▲ SAÍDA";
		}
		this.exit.part.Parent = outputs ? workspace.CurrentCamera : undefined;

		const inputs = ports.entry && hasInput(machine);
		if (inputs) {
			const linked = isInputLinked(machine, placement, others);
			this.entry.part.CFrame = origin.mul(new CFrame(0, 0.25, depth / 2 + 1.8)).mul(PORT_TURN);
			this.entry.part.Color = linked ? PORT_LINKED : INPUT_COLOR;
			const name = machine.id === "storage" ? "ENTRADA: QUALQUER LADO" : "▲ ENTRADA";
			this.entry.text.Text = linked ? "▲ ENTRADA LIGADA" : name;
		}
		this.entry.part.Parent = inputs ? workspace.CurrentCamera : undefined;
	}

	public hide() {
		this.body.Parent = undefined;
		this.exit.part.Parent = undefined;
		this.entry.part.Parent = undefined;
	}
}

function isOutputLinked(machine: MachineType, placement: Placement, others: Array<SeenStructure>): boolean {
	const front = new Set(frontCells(machine, placement));
	return others.some(
		(other) =>
			acceptsFrom(other.machine, placement.rotation, other.placement.rotation) &&
			occupiedCells(other.machine, other.placement).some((cell) => front.has(cell)),
	);
}

function isInputLinked(machine: MachineType, placement: Placement, others: Array<SeenStructure>): boolean {
	const cells = new Set(occupiedCells(machine, placement));
	return others.some(
		(other) =>
			hasOutput(other.machine) &&
			acceptsFrom(machine, other.placement.rotation, placement.rotation) &&
			frontCells(other.machine, other.placement).some((cell) => cells.has(cell)),
	);
}

/** Grade do terreno construível. Criada uma vez e ligada só na construção. */
export function createGrid(): (visible: boolean) => void {
	const folder = new Instance("Folder");
	folder.Name = "GenesisGrid";
	const length = HALF_EXTENT * 2 * CELL_SIZE;
	for (let i = -HALF_EXTENT; i <= HALF_EXTENT; i++) {
		const strong = i % 5 === 0;
		for (const alongX of [true, false]) {
			const line = ghostPart(`Linha ${cellKey(i, alongX ? 0 : 1)}`);
			const width = strong ? 0.16 : 0.08;
			line.Size = alongX ? new Vector3(length, 0.04, width) : new Vector3(width, 0.04, length);
			line.Position = alongX ? new Vector3(0, 0.14, i * CELL_SIZE) : new Vector3(i * CELL_SIZE, 0.14, 0);
			line.Color = theme.cyan;
			line.Material = Enum.Material.SmoothPlastic;
			line.Transparency = strong ? 0.6 : 0.82;
			line.Parent = folder;
		}
	}
	return (visible) => {
		folder.Parent = visible ? workspace : undefined;
	};
}
