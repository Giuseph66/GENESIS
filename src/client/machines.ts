import { STRUCTURE_STATUS } from "../shared/protocol";
import { readStructure, structuresFolder } from "./world";

const runService = game.GetService("RunService");
const workspace = game.GetService("Workspace");

/** Longe disto a animação não se lê e só custa. */
const VISIBLE_DISTANCE = 140;

/** Movimento local das máquinas em operação. Não altera o estado do servidor. */
export function mountMachines() {
	const folder = structuresFolder();
	const rest = new WeakMap<BasePart, CFrame>();
	const restOf = (part: BasePart) => {
		const known = rest.get(part);
		if (known) return known;
		rest.set(part, part.CFrame);
		return part.CFrame;
	};

	runService.RenderStepped.Connect(() => {
		const camera = workspace.CurrentCamera;
		if (!camera) return;
		const now = os.clock();
		for (const child of folder.GetChildren()) {
			if (child.GetAttribute(STRUCTURE_STATUS) !== "working") continue;
			const structure = readStructure(child);
			const base = structure?.model.PrimaryPart;
			if (!structure || !base || base.Position.sub(camera.CFrame.Position).Magnitude > VISIBLE_DISTANCE) continue;
			for (const part of structure.model.GetChildren()) {
				if (!part.IsA("BasePart")) continue;
				if (part.Name === "Broca" || part.Name === "Ponta") {
					const dip = math.sin(now * 5) * 0.25;
					part.CFrame = restOf(part).add(new Vector3(0, dip, 0)).mul(CFrame.Angles(now * 9, 0, 0));
				} else if (part.Name === "Turbina" || part.Name === "Anel") {
					part.CFrame = restOf(part).mul(CFrame.Angles(now * 7, 0, 0));
					if (part.Name === "Anel") part.Transparency = 0.25 + 0.25 * math.sin(now * 12);
				} else if (part.Name === "Braço" || part.Name === "Solda") {
					part.CFrame = restOf(part).add(base.CFrame.RightVector.mul(math.sin(now * 4) * 1.4));
				} else if (part.Name === "Boca") {
					part.Transparency = 0.2 + 0.2 * math.sin(now * 8);
				}
			}
		}
	});
}
