import { IN_ENCOUNTER } from "../shared/combat";
import { keyButton, panel, scaleToFit } from "./ui";

const player = game.GetService("Players").LocalPlayer;

const BUTTON_HEIGHT = 36;
const GAP = 4;
const WIDTH = 168;

export interface DockItem {
	readonly name: string;
	readonly key: string;
	readonly text: string;
	readonly run: () => void;
	/** Fica indisponível durante a expedição. */
	readonly baseOnly?: boolean;
}

/** Menu fixo: tudo que tem tecla também tem botão visível. */
export function mountDock(gui: ScreenGui, items: ReadonlyArray<DockItem>) {
	const frame = panel(gui, "Menu");
	frame.AnchorPoint = new Vector2(0, 1);
	frame.Position = new UDim2(0, 14, 1, -14);
	frame.Size = UDim2.fromOffset(WIDTH, items.size() * (BUTTON_HEIGHT + GAP) + GAP);
	scaleToFit(frame, 680);
	const buttons = items.map((item, index) => {
		const size = UDim2.fromOffset(WIDTH - GAP * 2, BUTTON_HEIGHT);
		const instance = keyButton(frame, item.name, item.key, item.text, size, item.run);
		instance.Position = UDim2.fromOffset(GAP, GAP + index * (BUTTON_HEIGHT + GAP));
		return { item, instance };
	});
	function refresh() {
		const inEncounter = player.GetAttribute(IN_ENCOUNTER) === true;
		for (const { item, instance } of buttons) {
			const enabled = !inEncounter || item.baseOnly !== true;
			instance.Active = enabled;
			instance.AutoButtonColor = enabled;
			for (const child of instance.GetChildren()) {
				if (child.IsA("TextLabel")) child.TextTransparency = enabled ? 0 : 0.6;
			}
		}
	}
	player.GetAttributeChangedSignal(IN_ENCOUNTER).Connect(refresh);
	refresh();
}
