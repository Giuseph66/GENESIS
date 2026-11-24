import type { Flat } from "../shared/combat";
import type { RoomKind } from "./expedition-templates";
import { Door, Layout, Room, roomHalfSize, roomPoint } from "./generation";

const tweens = game.GetService("TweenService");

const WALL_HEIGHT = 18;
const WALL_THICKNESS = 2;
const DOOR_HEIGHT = 12;
const DOOR_TWEEN = new TweenInfo(0.8, Enum.EasingStyle.Quad, Enum.EasingDirection.InOut);

const FLOOR = Color3.fromRGB(128, 136, 146);
const WALL = Color3.fromRGB(150, 158, 168);
const COVER = Color3.fromRGB(92, 102, 114);
const DOOR = Color3.fromRGB(255, 150, 51);
const LAMP = Color3.fromRGB(235, 240, 248);
const DARK = Color3.fromRGB(24, 30, 37);

const ACCENT: { readonly [kind in RoomKind]: Color3 } = {
	entry: Color3.fromRGB(228, 232, 237),
	encounter: Color3.fromRGB(255, 150, 51),
	upgrade: Color3.fromRGB(56, 201, 232),
	depot: Color3.fromRGB(232, 200, 72),
	boss: Color3.fromRGB(236, 84, 84),
	extraction: Color3.fromRGB(88, 214, 120),
};

const SIGN: { readonly [kind in RoomKind]: string } = {
	entry: "ENTRADA",
	encounter: "SETOR",
	upgrade: "OFICINA",
	depot: "DEPÓSITO",
	boss: "NÚCLEO DO GUARDIÃO",
	extraction: "EXTRAÇÃO",
};

export interface Sector {
	/** Tudo do setor. Destruir esta pasta limpa a tentativa. */
	readonly folder: Folder;
	/** Piso, paredes, portas e coberturas, que bloqueiam visão. */
	readonly geometry: Folder;
	/** Inimigos, avisos e objetos soltos. */
	readonly dynamic: Folder;
	readonly toWorld: (point: Flat, height: number) => Vector3;
	readonly toFlat: (position: Vector3) => Flat;
	readonly setDoor: (door: Door, open: boolean) => void;
}

export function block(
	parent: Instance,
	name: string,
	size: Vector3,
	position: Vector3,
	color: Color3,
	material: Enum.Material = Enum.Material.Metal,
): Part {
	const part = new Instance("Part");
	part.Name = name;
	part.Anchored = true;
	part.Size = size;
	part.Position = position;
	part.Color = color;
	part.Material = material;
	part.Parent = parent;
	return part;
}

/** Peça só visual: não colide nem entra em raycast. */
function decor(parent: Instance, name: string, size: Vector3, position: Vector3, color: Color3): Part {
	const part = block(parent, name, size, position, color, Enum.Material.Neon);
	part.CanCollide = false;
	part.CanQuery = false;
	part.CanTouch = false;
	part.CastShadow = false;
	return part;
}

function light(parent: BasePart, color: Color3, range: number, brightness: number) {
	const point = new Instance("PointLight");
	point.Color = color;
	point.Range = range;
	point.Brightness = brightness;
	point.Parent = parent;
}

function sign(parent: BasePart, face: Enum.NormalId, text: string, color: Color3) {
	const gui = new Instance("SurfaceGui");
	gui.Face = face;
	gui.LightInfluence = 0;
	gui.PixelsPerStud = 40;
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud;
	gui.Parent = parent;
	const label = new Instance("TextLabel");
	label.BackgroundColor3 = DARK;
	label.BackgroundTransparency = 0.1;
	label.AnchorPoint = new Vector2(0.5, 0.5);
	label.Position = UDim2.fromScale(0.5, 0.5);
	label.Size = UDim2.fromScale(0.9, 0.6);
	label.Font = Enum.Font.GothamBold;
	label.Text = text;
	label.TextColor3 = color;
	label.TextScaled = true;
	label.Parent = gui;
}

export function addPrompt(parent: BasePart, action: string, object: string, hold: number, onTriggered: (player: Player) => void) {
	const prompt = new Instance("ProximityPrompt");
	prompt.ActionText = action;
	prompt.ObjectText = object;
	prompt.HoldDuration = hold;
	prompt.MaxActivationDistance = 10;
	prompt.RequiresLineOfSight = false;
	prompt.Triggered.Connect(onTriggered);
	prompt.Parent = parent;
	return prompt;
}

/** Constrói o setor com primitivas. `origin` é o nível do piso na entrada. */
export function buildSector(layout: Layout, origin: Vector3, parent: Instance): Sector {
	const folder = new Instance("Folder");
	folder.Name = "Setor";
	const child = (name: string) => {
		const instance = new Instance("Folder");
		instance.Name = name;
		instance.Parent = folder;
		return instance;
	};
	const geometry = child("Geometria");
	const scenery = child("Detalhes");
	const dynamic = child("Dinamico");
	const toWorld = (point: Flat, height: number) => new Vector3(origin.X + point.x, origin.Y + height, origin.Z + point.z);
	const toFlat = (position: Vector3): Flat => ({ x: position.X - origin.X, z: position.Z - origin.Z });

	function wallPiece(room: Room, side: number, from: number, to: number, bottom: number, top: number) {
		if (to - from < 0.05 || top - bottom < 0.05) return;
		const half = roomHalfSize(room);
		const middle = (from + to) / 2;
		const alongX = side % 2 === 0;
		const inset = WALL_THICKNESS / 2;
		const direction = side === 0 || side === 3 ? -1 : 1;
		const at: Flat = alongX
			? { x: room.x + middle, z: room.z + direction * (half.z - inset) }
			: { x: room.x + direction * (half.x - inset), z: room.z + middle };
		const height = top - bottom;
		const size = alongX ? new Vector3(to - from, height, WALL_THICKNESS) : new Vector3(WALL_THICKNESS, height, to - from);
		block(geometry, "Parede", size, toWorld(at, bottom + height / 2), WALL, Enum.Material.Concrete);
		if (bottom === 0 && to - from > 4) {
			const face: Flat = alongX
				? { x: at.x, z: at.z - direction * (inset + 0.06) }
				: { x: at.x - direction * (inset + 0.06), z: at.z };
			const strip = alongX ? new Vector3(to - from - 2, 0.35, 0.12) : new Vector3(0.12, 0.35, to - from - 2);
			decor(scenery, "Faixa", strip, toWorld(face, 13), ACCENT[room.kind]);
		}
	}

	for (const room of layout.rooms) {
		const half = roomHalfSize(room);
		const size = new Vector3(half.x * 2, 2, half.z * 2);
		block(geometry, "Piso", size, toWorld(room, -1), FLOOR, Enum.Material.Concrete);
		for (const [dx, dz] of [
			[-1, -1],
			[1, -1],
			[-1, 1],
			[1, 1],
		]) {
			const at: Flat = { x: room.x + dx * (half.x - 4), z: room.z + dz * (half.z - 4) };
			const lamp = decor(scenery, "Luminária", new Vector3(1.4, 2.4, 1.4), toWorld(at, 14.5), LAMP);
			light(lamp, LAMP, math.min(60, math.max(half.x, half.z) * 1.3), 1.5);
		}
		for (const item of room.template.covers) {
			const turned = room.rotation % 2 === 1;
			const extent = new Vector3(turned ? item.depth : item.width, item.height, turned ? item.width : item.depth);
			block(geometry, "Cobertura", extent, toWorld(roomPoint(room, item), item.height / 2), COVER, Enum.Material.DiamondPlate);
		}
		for (let side = 0; side < 4; side++) {
			const alongX = side % 2 === 0;
			const reach = alongX ? half.x : half.z;
			const openings = layout.doors
				.filter((door) => (door.from === room.id ? door.side === side : door.to === room.id && (door.side + 2) % 4 === side))
				.map((door) => ({ center: alongX ? door.x - room.x : door.z - room.z, width: door.width }));
			openings.sort((a, b) => a.center < b.center);
			let cursor = -reach;
			for (const opening of openings) {
				wallPiece(room, side, cursor, opening.center - opening.width / 2, 0, WALL_HEIGHT);
				wallPiece(room, side, opening.center - opening.width / 2, opening.center + opening.width / 2, DOOR_HEIGHT, WALL_HEIGHT);
				cursor = opening.center + opening.width / 2;
			}
			wallPiece(room, side, cursor, reach, 0, WALL_HEIGHT);
		}
	}

	const doorParts = new Map<Door, Part>();
	for (const door of layout.doors) {
		const alongX = door.side % 2 === 0;
		const thickness = WALL_THICKNESS * 2 - 0.4;
		const size = alongX ? new Vector3(door.width, DOOR_HEIGHT, thickness) : new Vector3(thickness, DOOR_HEIGHT, door.width);
		doorParts.set(door, block(geometry, "Porta", size, toWorld(door, DOOR_HEIGHT / 2), DOOR, Enum.Material.DiamondPlate));

		const target = layout.rooms.find((room) => room.id === door.to);
		if (!target) continue;
		const plate = alongX ? new Vector3(door.width - 1, 2.6, thickness + 0.6) : new Vector3(thickness + 0.6, 2.6, door.width - 1);
		const board = block(scenery, "Placa", plate, toWorld(door, DOOR_HEIGHT + 2), DARK);
		board.CanQuery = false;
		const faces = [Enum.NormalId.Front, Enum.NormalId.Right, Enum.NormalId.Back, Enum.NormalId.Left];
		// A placa é lida por quem está na sala de origem.
		sign(board, faces[(door.side + 2) % 4], SIGN[target.kind], ACCENT[target.kind]);
	}

	function setDoor(door: Door, open: boolean) {
		const part = doorParts.get(door);
		if (!part) return;
		part.CanCollide = !open;
		part.CanQuery = !open;
		const height = open ? -DOOR_HEIGHT / 2 - 0.2 : DOOR_HEIGHT / 2;
		tweens.Create(part, DOOR_TWEEN, { Position: toWorld(door, height) }).Play();
	}

	folder.Parent = parent;
	return { folder, geometry, dynamic, toWorld, toFlat, setDoor };
}
