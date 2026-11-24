import { GRANTS, MAX_MEMBERS, PartyEntry } from "../shared/party";
import type { PlayerState } from "../shared/protocol";
import { requestCursor } from "./camera";
import { onState, send } from "./connection";
import { button, label, panel, scaleToFit, theme } from "./ui";

const input = game.GetService("UserInputService");
const player = game.GetService("Players").LocalPlayer;

const ROW_HEIGHT = 44;
const ROLE_NAME = { owner: "Proprietário", member: "Membro", visitor: "Visitante" };

/** Grupo do mundo: convites, permissões e saída. */
export function mountParty(gui: ScreenGui) {
	const frame = panel(gui, "Grupo");
	frame.AnchorPoint = new Vector2(0.5, 0.5);
	frame.Position = UDim2.fromScale(0.5, 0.45);
	frame.Visible = false;
	scaleToFit(frame, 640);
	const title = label(frame, "", UDim2.fromOffset(18, 12), UDim2.fromOffset(460, 24), 18, Enum.Font.GothamBold);
	const rows = new Instance("Frame");
	rows.BackgroundTransparency = 1;
	rows.Position = UDim2.fromOffset(18, 48);
	rows.Size = new UDim2(1, -36, 1, -60);
	rows.Parent = frame;

	function toggle() {
		frame.Visible = !frame.Visible;
		requestCursor("party", frame.Visible);
	}
	button(frame, "fechar", "X", UDim2.fromOffset(30, 28), toggle).Position = new UDim2(1, -42, 0, 10);

	function addRow(entry: PartyEntry, index: number, state: PlayerState) {
		const row = new Instance("Frame");
		row.BackgroundTransparency = 1;
		row.Position = UDim2.fromOffset(0, index * ROW_HEIGHT);
		row.Size = new UDim2(1, 0, 0, ROW_HEIGHT);
		row.Parent = rows;
		label(row, entry.name, UDim2.fromOffset(0, 2), UDim2.fromOffset(190, 18), 15, Enum.Font.GothamMedium);
		const status = `${ROLE_NAME[entry.role]}${entry.online ? "" : " · desconectado"}`;
		label(row, status, UDim2.fromOffset(0, 20), UDim2.fromOffset(190, 16), 12, Enum.Font.Gotham, theme.muted);

		const isOwner = state.role === "owner";
		if (entry.role === "visitor") {
			const text = entry.invited ? "Convite enviado" : "Convidar";
			const invite = button(row, "convidar", text, UDim2.fromOffset(130, 34), () => send({ kind: "invite", userId: entry.userId }));
			invite.Position = UDim2.fromOffset(200, 2);
			return;
		}
		if (entry.role === "owner") return;
		GRANTS.forEach((grant, column) => {
			const enabled = entry.grants[grant.id];
			const content = `${grant.name}: ${enabled ? "sim" : "não"}`;
			const instance = button(row, grant.id, content, UDim2.fromOffset(104, 34), () => {
				if (isOwner) send({ kind: "grant", userId: entry.userId, grant: grant.id, enabled: !enabled });
			});
			instance.Position = UDim2.fromOffset(200 + column * 110, 2);
			instance.TextColor3 = enabled ? theme.valid : theme.muted;
			instance.AutoButtonColor = isOwner;
		});
		const isSelf = entry.userId === player.UserId;
		if (!isOwner && !isSelf) return;
		const leave = button(row, "sair", isSelf ? "Sair" : "Remover", UDim2.fromOffset(84, 34), () => {
			send({ kind: "expel", userId: entry.userId });
		});
		leave.Position = UDim2.fromOffset(534, 2);
		leave.TextColor3 = theme.invalid;
	}

	const invite = panel(gui, "Convite");
	invite.AnchorPoint = new Vector2(0.5, 0);
	invite.Position = new UDim2(0.5, 0, 0, 60);
	invite.Size = UDim2.fromOffset(380, 108);
	invite.Visible = false;
	scaleToFit(invite, 480);
	const inviteText = label(invite, "", UDim2.fromOffset(16, 10), UDim2.fromOffset(348, 38), 15, Enum.Font.GothamMedium);
	const accept = button(invite, "aceitar", "Aceitar", UDim2.fromOffset(168, 40), () => send({ kind: "answer", accept: true }));
	accept.Position = UDim2.fromOffset(16, 56);
	const decline = button(invite, "recusar", "Recusar", UDim2.fromOffset(168, 40), () => send({ kind: "answer", accept: false }));
	decline.Position = UDim2.fromOffset(196, 56);

	onState((state) => {
		const members = state.party.filter((entry) => entry.role !== "visitor").size();
		title.Text = `Grupo do mundo (${members} de ${MAX_MEMBERS})`;
		frame.Size = UDim2.fromOffset(660, 66 + math.max(1, state.party.size()) * ROW_HEIGHT);
		rows.ClearAllChildren();
		state.party.forEach((entry, index) => addRow(entry, index, state));

		invite.Visible = state.invitedBy !== undefined;
		requestCursor("invite", invite.Visible);
		if (state.invitedBy !== undefined) inviteText.Text = `${state.invitedBy} convidou você para construir neste mundo.`;
	});

	input.InputBegan.Connect((event, processed) => {
		if (!processed && event.KeyCode === Enum.KeyCode.P) toggle();
	});
	return { toggle };
}
