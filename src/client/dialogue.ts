import type { PlayerState } from "../shared/protocol";
import { FACT_CHAPTER_ONE } from "../shared/research";
import { CHAPTER_END, currentMission } from "../shared/story";
import { onState } from "./connection";
import { label, panel, scaleToFit, theme } from "./ui";

const input = game.GetService("UserInputService");

const LETTERS_PER_SECOND = 45;
const HOLD_SECONDS = 3.2;

/** Falas de ECHO em fila. Uma instrução por vez, sem travar o jogo. */
export function mountDialogue(gui: ScreenGui, onSpeak: (seconds: number) => void) {
	const frame = panel(gui, "Echo");
	frame.AnchorPoint = new Vector2(0.5, 1);
	frame.Position = new UDim2(0.5, 0, 1, -174);
	frame.Size = UDim2.fromOffset(560, 84);
	frame.Visible = false;
	scaleToFit(frame, 660);
	const eye = new Instance("Frame");
	eye.Name = "Olho";
	eye.AnchorPoint = new Vector2(0.5, 0.5);
	eye.Position = UDim2.fromOffset(38, 42);
	eye.Size = UDim2.fromOffset(40, 40);
	eye.BackgroundColor3 = Color3.fromRGB(52, 60, 70);
	eye.Parent = frame;
	const pupil = new Instance("Frame");
	pupil.AnchorPoint = new Vector2(0.5, 0.5);
	pupil.Position = UDim2.fromScale(0.5, 0.5);
	pupil.Size = UDim2.fromScale(0.45, 0.45);
	pupil.BackgroundColor3 = theme.cyan;
	pupil.Parent = eye;
	for (const circle of [eye, pupil]) {
		const round = new Instance("UICorner");
		round.CornerRadius = new UDim(1, 0);
		round.Parent = circle;
	}
	label(frame, "ECHO", UDim2.fromOffset(72, 10), UDim2.fromOffset(200, 18), 17, Enum.Font.GothamBold, theme.cyan);
	const repeatHint = label(frame, "T repete", new UDim2(1, -96, 0, 12), UDim2.fromOffset(80, 16), 12, Enum.Font.Gotham, theme.muted);
	repeatHint.TextXAlignment = Enum.TextXAlignment.Right;
	const text = label(frame, "", UDim2.fromOffset(72, 32), UDim2.fromOffset(470, 46), 15, Enum.Font.Gotham);
	text.TextYAlignment = Enum.TextYAlignment.Top;

	const queue = new Array<string>();
	let playing = false;
	function play() {
		if (playing) return;
		playing = true;
		task.spawn(() => {
			while (queue.size() > 0) {
				const line = queue.shift()!;
				text.Text = line;
				onSpeak(line.size() / LETTERS_PER_SECOND + 1);
				pupil.BackgroundColor3 = theme.orange;
				text.MaxVisibleGraphemes = 0;
				frame.Visible = true;
				const total = utf8.len(line)[0];
				const letters = typeIs(total, "number") ? total : line.size();
				for (let shown = 0; shown <= letters; shown += 2) {
					text.MaxVisibleGraphemes = shown;
					task.wait(2 / LETTERS_PER_SECOND);
				}
				text.MaxVisibleGraphemes = -1;
				pupil.BackgroundColor3 = theme.cyan;
				task.wait(HOLD_SECONDS);
			}
			frame.Visible = false;
			playing = false;
		});
	}

	let last: string | undefined;
	let latest: PlayerState | undefined;
	/** ECHO repete a orientação atual quando o jogador pede. */
	function ask() {
		if (playing || !latest) return;
		const mission = currentMission(latest);
		const lines = mission ? [...mission.echo, mission.hint] : CHAPTER_END;
		for (const line of lines) queue.push(line);
		play();
	}
	input.InputBegan.Connect((event, processed) => {
		if (!processed && event.KeyCode === Enum.KeyCode.T) ask();
	});
	onState((state: PlayerState) => {
		latest = state;
		const mission = currentMission(state);
		const id = mission?.id ?? FACT_CHAPTER_ONE;
		if (id === last) return;
		const isFirst = last === undefined;
		last = id;
		// Ao voltar com o capítulo já encerrado, não repete o final.
		if (!mission && isFirst) return;
		for (const line of mission ? mission.echo : CHAPTER_END) queue.push(line);
		play();
	});
	return { ask };
}
