import { GATHER, ITEMS } from "../shared/catalog";
import { ENERGY_DEMAND, ENERGY_GRANTED, ENERGY_SUPPLY, PlayerState, Reason } from "../shared/protocol";
import { FACT_CHAPTER_ONE, RESEARCH } from "../shared/research";
import { currentMission } from "../shared/story";
import { onResult, onState } from "./connection";
import { bar, fontFor, hazardBand, label, panel, scaleToFit, swatch, theme } from "./ui";
import { numberAttribute, structuresFolder } from "./world";

const REASON_TEXT: { readonly [reason in Reason]: string } = {
	OK: "",
	INVALID_REQUEST: "Pedido inválido.",
	RATE_LIMITED: "Muitas ações seguidas. Aguarde um instante.",
	OUT_OF_BOUNDS: "Fora da área de construção.",
	RESERVED_AREA: "Área reservada do posto.",
	CELL_OCCUPIED: "Espaço ocupado.",
	NO_VEIN: "A mineradora precisa estar sobre um veio.",
	TOO_FAR: "Longe demais. Aproxime-se.",
	INSUFFICIENT_ITEMS: "Itens insuficientes no inventário.",
	INVENTORY_FULL: "Inventário cheio.",
	MACHINE_FULL: "A máquina está cheia.",
	NOTHING_TO_TAKE: "Nada para retirar.",
	MISSING_PREREQUISITE: "Ainda falta um passo. Veja o objetivo atual.",
	WORLD_UNAVAILABLE: "O mundo não pode ser salvo agora. Aguarde.",
	SECTOR_LOCKED: "O setor está selado. Pesquise o acesso no terminal.",
	RESEARCH_BUSY: "Já há uma pesquisa em andamento.",
	ALREADY_DONE: "Nenhuma pesquisa disponível agora.",
	TOO_SOON: "",
	DEPLETED: "Jazida esgotada. Ela se recompõe em alguns minutos.",
	NOT_MEMBER: "Você está visitando. Peça um convite ao proprietário.",
	PARTY_FULL: "O grupo já tem quatro membros.",
	INVITE_EXPIRED: "O convite expirou.",
	NOT_FOUND: "Essa construção não existe mais.",
	NOT_AUTHORIZED: "Você não tem permissão para isso.",
};

export function reasonText(reason: Reason): string {
	return REASON_TEXT[reason];
}

function objectiveFor(state: PlayerState): LuaTuple<[string, string]> {
	const active = RESEARCH.find((research) => research.id === state.research.active);
	if (active) return $tuple("Pesquisando", `${active.name}: ${math.ceil(state.research.left)} s.`);
	if (state.research.completed.includes("signal_reading") && !state.facts.includes(FACT_CHAPTER_ONE)) {
		return $tuple("Fale com ECHO", "Use o terminal para ouvir o que o sinal revelou.");
	}
	const mission = currentMission(state);
	if (mission) return $tuple(mission.objective, mission.hint);
	return $tuple("Capítulo 1 concluído", "Expanda a fábrica e explore o mundo.");
}

const CARD_WIDTH = 300;
const PAD = 16;
const ROW = 22;

export function mountHud(gui: ScreenGui) {
	const column = new Instance("Frame");
	column.Name = "Status";
	column.AnchorPoint = new Vector2(1, 0);
	column.Position = new UDim2(1, -14, 0, 14);
	column.Size = UDim2.fromOffset(CARD_WIDTH, 0);
	column.AutomaticSize = Enum.AutomaticSize.Y;
	column.BackgroundTransparency = 1;
	column.Parent = gui;
	scaleToFit(column, 760);
	const stack = new Instance("UIListLayout");
	stack.Padding = new UDim(0, 10);
	stack.SortOrder = Enum.SortOrder.LayoutOrder;
	stack.Parent = column;

	// Objetivo: o que fazer agora.
	const goal = panel(column, "Objetivo");
	goal.LayoutOrder = 1;
	goal.Size = UDim2.fromOffset(CARD_WIDTH, 0);
	goal.AutomaticSize = Enum.AutomaticSize.Y;
	hazardBand(goal, 8);
	const goalBody = new Instance("Frame");
	goalBody.BackgroundTransparency = 1;
	goalBody.Position = UDim2.fromOffset(0, 8);
	goalBody.Size = new UDim2(1, 0, 0, 0);
	goalBody.AutomaticSize = Enum.AutomaticSize.Y;
	goalBody.Parent = goal;
	const goalPad = new Instance("UIPadding");
	goalPad.PaddingLeft = new UDim(0, PAD);
	goalPad.PaddingRight = new UDim(0, PAD);
	goalPad.PaddingTop = new UDim(0, 10);
	goalPad.PaddingBottom = new UDim(0, 14);
	goalPad.Parent = goalBody;
	const goalList = new Instance("UIListLayout");
	goalList.Padding = new UDim(0, 4);
	goalList.SortOrder = Enum.SortOrder.LayoutOrder;
	goalList.Parent = goalBody;
	function flowLabel(order: number, size: number, font: Enum.Font, color = theme.text) {
		const line = label(goalBody, "", new UDim2(), new UDim2(1, 0, 0, 0), size, font, color);
		line.AutomaticSize = Enum.AutomaticSize.Y;
		line.LayoutOrder = order;
		return line;
	}
	const chapter = flowLabel(1, 13, Enum.Font.GothamMedium, theme.orange);
	const objective = flowLabel(2, 22, Enum.Font.GothamBold);
	objective.Text = "Conectando…";
	objective.LineHeight = 0.95;
	const message = flowLabel(3, 14, Enum.Font.Gotham, theme.muted);
	const progressHolder = new Instance("Frame");
	progressHolder.BackgroundTransparency = 1;
	progressHolder.Size = new UDim2(1, 0, 0, 12);
	progressHolder.LayoutOrder = 4;
	progressHolder.Parent = goalBody;
	const progress = bar(progressHolder, UDim2.fromOffset(0, 6), new UDim2(1, 0, 0, 6), theme.orange);

	// Carga e energia: o que o jogador tem e o que a base consome.
	const manifest = panel(column, "Carga");
	manifest.LayoutOrder = 2;
	manifest.Size = UDim2.fromOffset(CARD_WIDTH, 120);
	label(manifest, "Carga", UDim2.fromOffset(PAD, 10), UDim2.fromOffset(120, 18), 13, Enum.Font.GothamBold, theme.muted);
	const rows = ITEMS.map((item) => {
		const holder = new Instance("Frame");
		holder.BackgroundTransparency = 1;
		holder.Size = new UDim2(1, -PAD * 2, 0, ROW);
		holder.Parent = manifest;
		swatch(holder, item.color, new UDim2(0, 0, 0.5, 0));
		label(holder, item.name, UDim2.fromOffset(22, 0), new UDim2(1, -110, 1, 0), 14, Enum.Font.Gotham);
		const amount = label(holder, "", new UDim2(1, -90, 0, 0), new UDim2(0, 90, 1, 0), 17, Enum.Font.GothamBold);
		amount.TextXAlignment = Enum.TextXAlignment.Right;
		return { item, holder, amount };
	});
	const energyTitle = label(manifest, "Energia", UDim2.fromOffset(PAD, 0), UDim2.fromOffset(120, 18), 13, Enum.Font.GothamBold, theme.muted);
	const energyText = label(manifest, "", UDim2.fromOffset(PAD, 0), new UDim2(1, -PAD * 2, 0, 18), 14, Enum.Font.Gotham);
	energyText.TextXAlignment = Enum.TextXAlignment.Right;
	const energyFill = bar(manifest, UDim2.fromOffset(PAD, 0), new UDim2(1, -PAD * 2, 0, 8), theme.cyan);
	const energyTrack = energyFill.Parent as Frame;

	/** Lista só o que o jogador tem ou precisa coletar. */
	function layoutRows(state: PlayerState) {
		let y = 32;
		for (const { item, holder, amount } of rows) {
			const target = GATHER.find((gather) => gather.item === item.id)?.goal;
			const owned = state.inventory[item.id];
			const tracking = target !== undefined && !state.suppliesReady;
			holder.Visible = owned > 0 || tracking;
			if (!holder.Visible) continue;
			holder.Position = UDim2.fromOffset(PAD, y);
			amount.Text = tracking ? `${owned}/${target}` : `${owned}`;
			amount.TextColor3 = tracking && owned >= (target ?? 0) ? theme.valid : theme.text;
			y += ROW;
		}
		energyTitle.Position = UDim2.fromOffset(PAD, y + 10);
		energyText.Position = UDim2.fromOffset(PAD, y + 10);
		energyTrack.Position = UDim2.fromOffset(PAD, y + 34);
		manifest.Size = UDim2.fromOffset(CARD_WIDTH, y + 56);
	}

	onState((state) => {
		layoutRows(state);
		const [title, text] = objectiveFor(state);
		chapter.Text = currentMission(state)?.title ?? "Capítulo 1 — O Despertar";
		objective.Text = title;
		message.Text = text;
		const active = RESEARCH.find((research) => research.id === state.research.active);
		let fraction: number | undefined;
		if (active) fraction = 1 - state.research.left / active.seconds;
		else if (!state.suppliesReady) {
			let have = 0;
			let need = 0;
			for (const gather of GATHER) {
				have += math.min(state.inventory[gather.item], gather.goal);
				need += gather.goal;
			}
			fraction = have / need;
		}
		progressHolder.Visible = fraction !== undefined;
		progress.Size = UDim2.fromScale(math.clamp(fraction ?? 0, 0, 1), 1);
		progress.BackgroundColor3 = active ? theme.cyan : theme.orange;
	});

	task.spawn(() => {
		const folder = structuresFolder();
		function refresh() {
			const supply = numberAttribute(folder, ENERGY_SUPPLY) ?? 0;
			const demand = numberAttribute(folder, ENERGY_DEMAND) ?? 0;
			const granted = numberAttribute(folder, ENERGY_GRANTED) ?? 0;
			const deficit = demand - granted;
			energyText.Text = supply === 0 ? "Gerador parado" : `${granted} de ${supply} em uso`;
			energyText.TextColor3 = deficit > 0 || supply === 0 ? theme.invalid : theme.text;
			energyFill.Size = UDim2.fromScale(supply > 0 ? math.clamp(granted / supply, 0, 1) : 0, 1);
			energyFill.BackgroundColor3 = deficit > 0 ? theme.invalid : theme.cyan;
		}
		folder.AttributeChanged.Connect(refresh);
		refresh();
	});

	const toast = new Instance("TextLabel");
	toast.Name = "Aviso";
	toast.AnchorPoint = new Vector2(0.5, 0);
	toast.Position = new UDim2(0.5, 0, 0, 14);
	toast.Size = UDim2.fromOffset(0, 40);
	toast.AutomaticSize = Enum.AutomaticSize.X;
	toast.BackgroundColor3 = theme.surface;
	toast.BackgroundTransparency = 0.04;
	toast.FontFace = fontFor(Enum.Font.GothamMedium, 15);
	toast.TextSize = 16;
	toast.TextColor3 = theme.text;
	toast.Visible = false;
	const toastPad = new Instance("UIPadding");
	toastPad.PaddingLeft = new UDim(0, 20);
	toastPad.PaddingRight = new UDim(0, 20);
	toastPad.Parent = toast;
	const toastCorner = new Instance("UICorner");
	toastCorner.CornerRadius = new UDim(0, 6);
	toastCorner.Parent = toast;
	const toastStroke = new Instance("UIStroke");
	toastStroke.Color = theme.orange;
	toastStroke.Thickness = 1.5;
	toastStroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border;
	toastStroke.Parent = toast;
	toast.Parent = gui;
	let shown = 0;
	function showToast(text: string) {
		if (text === "") return;
		shown += 1;
		const id = shown;
		toast.Text = text;
		toast.Visible = true;
		task.delay(2.5, () => {
			if (id === shown) toast.Visible = false;
		});
	}
	onResult((result) => showToast(reasonText(result.reason)));
	return { showToast };
}
