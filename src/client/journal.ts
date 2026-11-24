import type { PlayerState } from "../shared/protocol";
import { FACT_GUARDIAN_RECORD } from "../shared/research";
import { currentMission, MISSIONS } from "../shared/story";
import { requestCursor } from "./camera";
import { onState } from "./connection";
import { button, label, panel, scaleToFit, theme } from "./ui";

const input = game.GetService("UserInputService");

/** Diário: missões do capítulo e registros recuperados. */
export function mountJournal(gui: ScreenGui) {
	const frame = panel(gui, "Diario");
	frame.AnchorPoint = new Vector2(0.5, 0.5);
	frame.Position = UDim2.fromScale(0.5, 0.45);
	frame.Size = UDim2.fromOffset(460, 110 + MISSIONS.size() * 34);
	frame.Visible = false;
	scaleToFit(frame, 540);
	label(frame, "Diário", UDim2.fromOffset(18, 12), UDim2.fromOffset(300, 16), 13, Enum.Font.GothamMedium, theme.orange);
	label(frame, "Capítulo 1 — O Despertar", UDim2.fromOffset(18, 30), UDim2.fromOffset(380, 22), 18, Enum.Font.GothamBold);

	function toggle() {
		frame.Visible = !frame.Visible;
		requestCursor("journal", frame.Visible);
	}
	const close = button(frame, "fechar", "X", UDim2.fromOffset(30, 28), toggle);
	close.Position = new UDim2(1, -40, 0, 10);

	const rows = MISSIONS.map((mission, index) => {
		const y = 62 + index * 34;
		const title = label(frame, mission.title, UDim2.fromOffset(18, y), UDim2.fromOffset(420, 16), 14, Enum.Font.GothamMedium);
		const detail = label(frame, "", UDim2.fromOffset(18, y + 16), UDim2.fromOffset(420, 14), 12, Enum.Font.Gotham, theme.muted);
		return { mission, title, detail };
	});
	const record = label(frame, "", new UDim2(0, 18, 1, -40), UDim2.fromOffset(420, 30), 12, Enum.Font.Gotham, theme.cyan);

	onState((state: PlayerState) => {
		const current = currentMission(state);
		for (const { mission, title, detail } of rows) {
			const done = mission.isDone(state);
			const isCurrent = current === mission;
			title.Text = done ? `Concluída: ${mission.title}` : isCurrent ? mission.title : "Missão bloqueada";
			title.TextColor3 = done ? theme.valid : isCurrent ? theme.text : theme.muted;
			detail.Text = isCurrent ? mission.objective : "";
		}
		record.Text = state.facts.includes(FACT_GUARDIAN_RECORD)
			? "Registro do Guardião: ordem de evacuação com o identificador GENESIS."
			: "Nenhum registro recuperado.";
	});

	input.InputBegan.Connect((event, processed) => {
		if (!processed && event.KeyCode === Enum.KeyCode.J) toggle();
	});
	return { toggle };
}
