import { Counts, ITEMS } from "../shared/catalog";
import { IN_ENCOUNTER } from "../shared/combat";
import {
	EXPEDITION_COMMAND_REMOTE,
	EXPEDITION_NOTICE_REMOTE,
	EXPEDITION_STATE_REMOTE,
	ExpeditionCommand,
	ExpeditionResult,
	ExpeditionState,
	findUpgrade,
	Offer,
	Rarity,
	RARITY_NAME,
} from "../shared/expedition";
import { REMOTES_FOLDER } from "../shared/protocol";
import { requestCursor } from "./camera";
import { button, label, panel, scaleToFit, theme } from "./ui";

const input = game.GetService("UserInputService");
const replicatedStorage = game.GetService("ReplicatedStorage");
const player = game.GetService("Players").LocalPlayer;

const RARITY_COLOR: { readonly [rarity in Rarity]: Color3 } = {
	common: theme.text,
	uncommon: theme.cyan,
	rare: theme.orange,
};
const LEAVE_CONFIRM_SECONDS = 3;
const SUMMARY_SECONDS = 12;
const CHOICE_KEYS: ReadonlyArray<Enum.KeyCode> = [Enum.KeyCode.One, Enum.KeyCode.Two, Enum.KeyCode.Three];

function listItems(counts: Counts): string {
	const lines = new Array<string>();
	for (const item of ITEMS) {
		const amount = counts[item.id] ?? 0;
		if (amount > 0) lines.push(`${amount} ${item.name}`);
	}
	return lines.isEmpty() ? "Nada" : lines.join(", ");
}

const TITLE: { readonly [outcome in ExpeditionResult["outcome"]]: string } = {
	extracted: "Extração confirmada",
	died: "Você caiu na expedição",
	left: "Expedição abandonada",
	failed: "Expedição encerrada",
};

export function mountExpedition(gui: ScreenGui) {
	const folder = replicatedStorage.WaitForChild(REMOTES_FOLDER);
	const stateRemote = folder.WaitForChild(EXPEDITION_STATE_REMOTE) as RemoteEvent<(state: ExpeditionState) => void>;
	const noticeRemote = folder.WaitForChild(EXPEDITION_NOTICE_REMOTE) as RemoteEvent<(message: string) => void>;
	const commandRemote = folder.WaitForChild(EXPEDITION_COMMAND_REMOTE) as RemoteEvent<(command: ExpeditionCommand) => void>;

	const frame = panel(gui, "Expedicao");
	frame.AnchorPoint = new Vector2(0, 0.5);
	frame.Position = new UDim2(0, 14, 0.5, 0);
	frame.Size = UDim2.fromOffset(290, 216);
	frame.Visible = false;
	scaleToFit(frame, 700);
	const line = (y: number, height: number, size: number, font: Enum.Font, color = theme.text) => {
		const instance = label(frame, "", UDim2.fromOffset(14, y), UDim2.fromOffset(262, height), size, font, color);
		instance.TextYAlignment = Enum.TextYAlignment.Top;
		return instance;
	};
	const header = line(10, 14, 11, Enum.Font.GothamBold, theme.orange);
	const objective = line(28, 22, 16, Enum.Font.GothamBold);
	const detail = line(52, 18, 13, Enum.Font.Gotham, theme.muted);
	const loot = line(78, 50, 13, Enum.Font.Gotham);
	const upgrades = line(130, 36, 12, Enum.Font.Gotham, theme.cyan);

	let leaveAsked = 0;
	const leave = button(frame, "abandonar", "Abandonar", UDim2.fromOffset(262, 32), () => {
		// Abandonar perde a mochila, por isso pede um segundo toque.
		if (os.clock() - leaveAsked < LEAVE_CONFIRM_SECONDS) {
			leaveAsked = 0;
			commandRemote.FireServer({ kind: "leave" });
			return;
		}
		leaveAsked = os.clock();
		leave.Text = "Perder a mochila? Toque de novo";
		task.delay(LEAVE_CONFIRM_SECONDS, () => {
			leave.Text = "Abandonar";
		});
	});
	leave.Position = UDim2.fromOffset(14, 174);

	const boss = panel(gui, "Chefe");
	boss.AnchorPoint = new Vector2(0.5, 0);
	boss.Position = new UDim2(0.5, 0, 0, 54);
	boss.Size = UDim2.fromOffset(420, 44);
	boss.Visible = false;
	scaleToFit(boss, 700);
	const bossName = label(boss, "", UDim2.fromOffset(12, 4), UDim2.fromOffset(396, 18), 14, Enum.Font.GothamBold);
	const bossTrack = new Instance("Frame");
	bossTrack.BackgroundColor3 = theme.group;
	bossTrack.BorderSizePixel = 0;
	bossTrack.Position = UDim2.fromOffset(12, 26);
	bossTrack.Size = UDim2.fromOffset(396, 10);
	bossTrack.Parent = boss;
	const bossFill = new Instance("Frame");
	bossFill.BackgroundColor3 = theme.invalid;
	bossFill.BorderSizePixel = 0;
	bossFill.Parent = bossTrack;

	const offerFrame = panel(gui, "Melhorias");
	offerFrame.AnchorPoint = new Vector2(0.5, 0.5);
	offerFrame.Position = UDim2.fromScale(0.5, 0.45);
	offerFrame.Size = UDim2.fromOffset(600, 190);
	offerFrame.Visible = false;
	scaleToFit(offerFrame, 640);
	label(offerFrame, "Escolha uma melhoria (1, 2 ou 3)", UDim2.fromOffset(16, 10), UDim2.fromOffset(560, 24), 18, Enum.Font.GothamBold);
	let offered: Offer | undefined;
	function choose(index: number) {
		const id = offered?.options[index];
		if (offered && id !== undefined) commandRemote.FireServer({ kind: "choose", roomId: offered.roomId, upgrade: id });
	}
	input.InputBegan.Connect((event, processed) => {
		if (!processed && offered) choose(CHOICE_KEYS.indexOf(event.KeyCode));
	});
	const cards = [0, 1, 2].map((index) => {
		const card = button(offerFrame, `melhoria${index}`, "", UDim2.fromOffset(180, 130), () => choose(index));
		card.Position = UDim2.fromOffset(16 + index * 194, 46);
		return card;
	});

	const summary = panel(gui, "Resumo");
	summary.AnchorPoint = new Vector2(0.5, 0.5);
	summary.Position = UDim2.fromScale(0.5, 0.45);
	summary.Size = UDim2.fromOffset(380, 220);
	summary.Visible = false;
	scaleToFit(summary, 500);
	const summaryTitle = label(summary, "", UDim2.fromOffset(18, 14), UDim2.fromOffset(344, 26), 20, Enum.Font.GothamBold);
	const summaryText = label(summary, "", UDim2.fromOffset(18, 48), UDim2.fromOffset(344, 110), 14, Enum.Font.Gotham, theme.muted);
	summaryText.TextYAlignment = Enum.TextYAlignment.Top;
	let summaryCount = 0;
	function hideSummary() {
		summary.Visible = false;
		requestCursor("summary", false);
	}
	const closeSummary = button(summary, "continuar", "Continuar", UDim2.fromOffset(344, 40), () => {
		hideSummary();
	});
	closeSummary.Position = UDim2.fromOffset(18, 166);

	const notice = label(gui, "", new UDim2(0.5, 0, 0, 106), UDim2.fromOffset(360, 34), 16, Enum.Font.GothamBold, theme.orange);
	notice.Name = "AvisoExpedicao";
	notice.AnchorPoint = new Vector2(0.5, 0);
	notice.BackgroundColor3 = theme.surface;
	notice.BackgroundTransparency = 0.1;
	notice.TextXAlignment = Enum.TextXAlignment.Center;
	notice.Visible = false;
	let noticeCount = 0;

	function showOffer(offer: Offer | undefined) {
		offered = offer;
		offerFrame.Visible = offer !== undefined;
		requestCursor("offer", offer !== undefined);
		cards.forEach((card, index) => {
			const upgrade = findUpgrade(offer?.options[index]);
			card.Visible = upgrade !== undefined;
			if (!upgrade) return;
			card.Text = `${RARITY_NAME[upgrade.rarity]}\n\n${upgrade.name}\n${upgrade.text}`;
			card.TextColor3 = RARITY_COLOR[upgrade.rarity];
		});
	}

	function showResult(result: ExpeditionResult) {
		summaryTitle.Text = TITLE[result.outcome];
		summaryTitle.TextColor3 = result.outcome === "extracted" ? theme.valid : theme.invalid;
		const lines = [`Assegurado: ${listItems(result.secured)}`, `Perdido: ${listItems(result.lost)}`];
		if (result.record) lines.push("Registro do Guardião recuperado.");
		lines.push(result.outcome === "extracted" ? "Próximo passo: fale com ECHO no terminal." : "Sua base e seu equipamento estão intactos.");
		summaryText.Text = lines.join("\n\n");
		summary.Visible = true;
		requestCursor("summary", true);
		summaryCount += 1;
		const id = summaryCount;
		task.delay(SUMMARY_SECONDS, () => {
			if (id === summaryCount) hideSummary();
		});
	}

	function refreshVisibility() {
		const active = player.GetAttribute(IN_ENCOUNTER) === true;
		frame.Visible = active;
		if (!active) {
			boss.Visible = false;
			showOffer(undefined);
		}
	}

	stateRemote.OnClientEvent.Connect((state) => {
		header.Text = `Expedição, sala ${math.max(1, state.room)} de ${state.rooms}`;
		objective.Text = state.objective;
		const exit = { locked: "Saída bloqueada", available: "Saída disponível", confirming: "Confirmando…" }[state.extraction];
		detail.Text = state.enemies > 0 ? `${exit} · ${state.enemies} hostis` : exit;
		detail.TextColor3 = state.extraction === "available" ? theme.valid : theme.muted;
		loot.Text = `Mochila: ${listItems(state.loot)}`;
		const names = state.upgrades.mapFiltered((id) => findUpgrade(id)?.name);
		upgrades.Text = names.isEmpty() ? "" : `Melhorias: ${names.join(", ")}`;
		boss.Visible = state.boss !== undefined;
		if (state.boss) {
			bossName.Text = state.boss.name;
			bossFill.Size = UDim2.fromScale(math.clamp(state.boss.health / state.boss.max, 0, 1), 1);
		}
		showOffer(state.offer);
		if (state.result) showResult(state.result);
	});
	noticeRemote.OnClientEvent.Connect((message) => {
		noticeCount += 1;
		const id = noticeCount;
		notice.Text = message;
		notice.Visible = true;
		task.delay(3, () => {
			if (id === noticeCount) notice.Visible = false;
		});
	});
	player.GetAttributeChangedSignal(IN_ENCOUNTER).Connect(refreshVisibility);
	refreshVisibility();
}
