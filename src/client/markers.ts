import type { PlayerState } from "../shared/protocol";
import { IN_ENCOUNTER } from "../shared/combat";
import { FACT_CHAPTER_ONE, FACT_GUARDIAN_RECORD } from "../shared/research";
import { onState } from "./connection";
import { theme } from "./ui";

const players = game.GetService("Players");
const runService = game.GetService("RunService");
const workspace = game.GetService("Workspace");

const player = players.LocalPlayer;

interface Goal {
	readonly name: string;
	readonly position: Vector3;
	/** Perto disto o marcador some, pois o alvo já está à vista. */
	readonly hideWithin: number;
}

const BASE: Goal = { name: "Posto", position: new Vector3(0, 10, 0), hideWithin: 110 };

function goalFor(state: PlayerState): Goal {
	if (!state.suppliesReady) {
		const needsIron = state.inventory.iron_ore < 30;
		const position = new Vector3(needsIron ? -15 : 15, 5, -11);
		return { name: needsIron ? "Minério de ferro" : "Carvão", position, hideWithin: 12 };
	}
	if (!state.generatorRestored) return { name: "Gerador", position: new Vector3(24, 7, 14), hideWithin: 14 };
	if (!state.automationDone) return { name: "Veio de ferro", position: new Vector3(44, 5, -4), hideWithin: 30 };
	if (!state.research.completed.includes("maintenance_access")) {
		return { name: "Terminal", position: new Vector3(0, 7, -6), hideWithin: 12 };
	}
	if (state.facts.includes(FACT_GUARDIAN_RECORD) && !state.facts.includes(FACT_CHAPTER_ONE)) {
		return { name: "Terminal", position: new Vector3(0, 7, -6), hideWithin: 12 };
	}
	return { name: "Setor de manutenção", position: new Vector3(0, 11, -26), hideWithin: 20 };
}

/** Aponta o objetivo atual. Longe do posto, aponta o caminho de volta. */
export function mountMarkers(gui: ScreenGui) {
	const anchor = new Instance("Part");
	anchor.Name = "Marcador";
	anchor.Anchored = true;
	anchor.CanCollide = false;
	anchor.CanQuery = false;
	anchor.CanTouch = false;
	anchor.Transparency = 1;
	anchor.Size = new Vector3(0.2, 0.2, 0.2);
	anchor.Parent = workspace;
	const marker = new Instance("BillboardGui");
	marker.Name = "Objetivo";
	marker.AlwaysOnTop = true;
	marker.Size = UDim2.fromOffset(170, 40);
	marker.Adornee = anchor;
	marker.Enabled = false;
	marker.ResetOnSpawn = false;
	// Billboard aninhado em ScreenGui não é desenhado.
	marker.Parent = gui.Parent;
	const text = new Instance("TextLabel");
	text.BackgroundTransparency = 1;
	text.Size = UDim2.fromScale(1, 1);
	text.Font = Enum.Font.GothamBold;
	text.TextColor3 = theme.orange;
	text.TextSize = 15;
	text.TextStrokeTransparency = 0.4;
	text.Parent = marker;

	let goal: Goal | undefined;
	onState((state) => {
		goal = goalFor(state);
	});
	runService.RenderStepped.Connect(() => {
		const root = player.Character?.FindFirstChild("HumanoidRootPart");
		if (!goal || !root?.IsA("BasePart") || player.GetAttribute(IN_ENCOUNTER) === true) {
			marker.Enabled = false;
			return;
		}
		const isFar = root.Position.sub(BASE.position).Magnitude > BASE.hideWithin;
		const shown = isFar ? BASE : goal;
		const distance = root.Position.sub(shown.position).Magnitude;
		anchor.Position = shown.position;
		text.Text = `▼ ${shown.name}\n${math.floor(distance)} m`;
		marker.Enabled = distance > shown.hideWithin;
	});
}
