import { ENEMIES, EnemyId, Flat, flatDirection, flatDistance } from "../shared/combat";
import { Enemy, Swing } from "./enemy";
import { block, Sector } from "./expedition-builder";

const ORANGE = Color3.fromRGB(255, 150, 51);
const CYAN = Color3.fromRGB(56, 201, 232);
const RUST = Color3.fromRGB(196, 92, 62);
const RED = Color3.fromRGB(236, 84, 84);
const DARK = Color3.fromRGB(38, 44, 52);

/** Desvios testados para contornar obstáculos, do menor ao maior. */
const TURNS = [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8];
const PROBE = 5;

export interface Body {
	readonly enemy: Enemy;
	readonly model: Model;
	readonly hover: number;
	readonly roomId: number;
	readonly bar: Frame;
}

export function createBody(sector: Sector, id: EnemyId, position: Flat, roomId: number): Body {
	const kind = ENEMIES[id];
	const enemy = new Enemy(kind, position);
	const model = new Instance("Model");
	model.Name = kind.name;
	const size = id === "guardian" ? new Vector3(8, 9, 6) : id === "robot" ? new Vector3(4, 5, 3) : new Vector3(3.4, 1.4, 3.4);
	const hover = id === "drone" ? 5 : size.Y / 2 + (id === "guardian" ? 2 : 1);
	const color = id === "guardian" ? ORANGE : id === "robot" ? RUST : CYAN;
	const origin = sector.toWorld(position, hover);
	const piece = (name: string, extent: Vector3, offset: Vector3, tint: Color3, material: Enum.Material = Enum.Material.Metal) => {
		const part = block(model, name, extent, origin.add(offset), tint, material);
		part.CanCollide = false;
		return part;
	};
	const trunk = piece("Corpo", size, new Vector3(), color);
	piece("Olho", new Vector3(size.X * 0.5, math.max(0.4, size.Y * 0.12), 0.4), new Vector3(0, size.Y * 0.22, -size.Z / 2), RED, Enum.Material.Neon);
	if (id === "drone") {
		for (const side of [-1, 1]) piece("Rotor", new Vector3(2, 0.3, 2), new Vector3(side * 2.4, 0.6, 0), DARK);
	} else {
		for (const side of [-1, 1]) {
			const armSize = new Vector3(size.X * 0.25, size.Y * 0.8, size.Z * 0.4);
			piece("Braço", armSize, new Vector3(side * size.X * 0.65, -size.Y * 0.05, -size.Z * 0.15), DARK);
			const legSize = new Vector3(size.X * 0.28, hover - size.Y / 2 + 0.2, size.Z * 0.4);
			piece("Perna", legSize, new Vector3(side * size.X * 0.28, -size.Y / 2 - legSize.Y / 2, 0), DARK);
		}
	}
	model.PrimaryPart = trunk;

	const gui = new Instance("BillboardGui");
	gui.Size = UDim2.fromScale(7, 1.4);
	gui.StudsOffset = new Vector3(0, size.Y / 2 + 1.6, 0);
	gui.MaxDistance = 120;
	gui.Parent = trunk;
	const name = new Instance("TextLabel");
	name.BackgroundTransparency = 1;
	name.Size = UDim2.fromScale(1, 0.6);
	name.Font = Enum.Font.GothamMedium;
	name.Text = kind.name;
	name.TextColor3 = Color3.fromRGB(228, 232, 237);
	name.TextStrokeTransparency = 0.5;
	name.TextScaled = true;
	name.Parent = gui;
	const track = new Instance("Frame");
	track.BackgroundColor3 = DARK;
	track.BorderSizePixel = 0;
	track.Position = UDim2.fromScale(0, 0.7);
	track.Size = UDim2.fromScale(1, 0.25);
	track.Parent = gui;
	const bar = new Instance("Frame");
	bar.BackgroundColor3 = RED;
	bar.BorderSizePixel = 0;
	bar.Size = UDim2.fromScale(1, 1);
	bar.Parent = track;

	model.Parent = sector.dynamic;
	return { enemy, model, hover, roomId, bar };
}

export function placeBody(sector: Sector, body: Body) {
	const { enemy } = body;
	const position = sector.toWorld(enemy.position, body.hover);
	body.model.PivotTo(CFrame.lookAt(position, position.add(new Vector3(enemy.aim.x, 0, enemy.aim.z))));
}

/** Anda até o destino e contorna obstáculos por sondagem. */
export function moveEnemy(enemy: Enemy, seconds: number, hasSight: (from: Flat, to: Flat) => boolean) {
	const goal = enemy.destination;
	const direction = goal && flatDirection(enemy.position, goal);
	if (!goal || !direction) return;
	const walk = math.min(flatDistance(enemy.position, goal), enemy.kind.speed * seconds);
	for (const turn of TURNS) {
		const cos = math.cos(turn);
		const sin = math.sin(turn);
		const heading = { x: direction.x * cos - direction.z * sin, z: direction.x * sin + direction.z * cos };
		const probe = { x: enemy.position.x + heading.x * PROBE, z: enemy.position.z + heading.z * PROBE };
		if (!hasSight(enemy.position, probe)) continue;
		enemy.position = { x: enemy.position.x + heading.x * walk, z: enemy.position.z + heading.z * walk };
		return;
	}
}

/** Marca no chão a área do golpe durante o aviso. */
export function showTelegraph(sector: Sector, swing: Swing) {
	const { attack, origin, aim } = swing;
	const ground = sector.toWorld(origin, 0.12);
	const base = CFrame.lookAt(ground, ground.add(new Vector3(aim.x, 0, aim.z)));
	const mark = (size: Vector3, cframe: CFrame, shape: Enum.PartType = Enum.PartType.Block) => {
		const part = block(sector.dynamic, "Aviso", size, ground, RED, Enum.Material.Neon);
		part.Shape = shape;
		part.Size = size;
		part.CFrame = cframe;
		part.CanCollide = false;
		part.CanQuery = false;
		part.CanTouch = false;
		part.CastShadow = false;
		part.Transparency = 0.5;
		task.delay(attack.windup, () => part.Destroy());
	};
	if (attack.shape === "line") {
		mark(new Vector3(attack.width, 0.15, attack.range), base.mul(new CFrame(0, 0, -attack.range / 2)));
	} else if (attack.shape === "area") {
		const size = new Vector3(0.15, attack.range * 2, attack.range * 2);
		mark(size, new CFrame(ground).mul(CFrame.Angles(0, 0, math.pi / 2)), Enum.PartType.Cylinder);
	} else {
		// Setor em fatias, para o aviso acompanhar o arco real do golpe.
		const slices = 7;
		const step = (attack.halfAngle * 2) / slices;
		const width = 2 * attack.range * math.tan(step / 2);
		for (let i = 0; i < slices; i++) {
			const turn = CFrame.Angles(0, -attack.halfAngle + step * (i + 0.5), 0);
			const size = new Vector3(width, 0.15, attack.range * 0.75);
			mark(size, base.mul(turn).mul(new CFrame(0, 0, -attack.range * 0.625)));
		}
	}
}
