import { RESOURCES } from "../shared/catalog";
import type { PlayerState, Reason } from "../shared/protocol";
import { onResult, onState } from "./connection";
import { label, panel, scaleToFit, theme } from "./ui";

const REASON_TEXT: { readonly [reason in Reason]: string } = {
	OK: "",
	INVALID_REQUEST: "Pedido inválido.",
	RATE_LIMITED: "Muitas ações seguidas. Aguarde um instante.",
	ECHO_OFFLINE: "Ative o terminal de ECHO primeiro.",
	OUT_OF_BOUNDS: "Fora da área de construção.",
	RESERVED_AREA: "Área reservada do posto.",
	CELL_OCCUPIED: "Espaço ocupado.",
	TOO_FAR: "Longe demais. Aproxime-se.",
	INSUFFICIENT_ITEMS: "Minério de ferro insuficiente.",
	INVENTORY_FULL: "Inventário cheio.",
	NOT_FOUND: "Essa construção não existe mais.",
	NOT_AUTHORIZED: "Essa construção não é sua.",
};

export function reasonText(reason: Reason): string {
	return REASON_TEXT[reason];
}

export function mountHud(gui: ScreenGui) {
	const frame = panel(gui, "Status");
	frame.AnchorPoint = new Vector2(1, 0);
	frame.Position = new UDim2(1, -14, 0, 10);
	frame.Size = UDim2.fromOffset(274, 158);
	scaleToFit(frame, 700);

	const accent = new Instance("Frame");
	accent.Size = new UDim2(0, 4, 1, 0);
	accent.BorderSizePixel = 0;
	accent.BackgroundColor3 = theme.orange;
	accent.Parent = frame;

	const row = (y: number, height: number) => $tuple(UDim2.fromOffset(15, y), UDim2.fromOffset(246, height));
	const [titlePosition, titleSize] = row(10, 14);
	label(frame, "POSTO GENESIS", titlePosition, titleSize, 11, Enum.Font.GothamBold, theme.orange);
	const [objectivePosition, objectiveSize] = row(28, 22);
	const objective = label(frame, "Conectando…", objectivePosition, objectiveSize, 17, Enum.Font.GothamBold);
	const [messagePosition, messageSize] = row(52, 34);
	const message = label(frame, "", messagePosition, messageSize, 13, Enum.Font.Gotham, theme.muted);
	message.TextYAlignment = Enum.TextYAlignment.Top;
	const [headerPosition, headerSize] = row(97, 13);
	label(frame, "INVENTÁRIO", headerPosition, headerSize, 11, Enum.Font.GothamBold, theme.cyan);

	const counts = RESOURCES.map((resource, index) => {
		const [position, size] = row(115 + index * 20, 16);
		label(frame, resource.name, position, size, 13, Enum.Font.Gotham);
		const count = label(frame, "", position, size, 13, Enum.Font.GothamMedium);
		count.TextXAlignment = Enum.TextXAlignment.Right;
		return count;
	});

	function refresh(state: PlayerState) {
		RESOURCES.forEach((resource, index) => {
			const amount = state.inventory[resource.id];
			counts[index].Text = state.suppliesReady ? `${amount}` : `${amount} / ${resource.goal}`;
		});

		if (!state.echoOnline) {
			objective.Text = "Ative o terminal de ECHO";
			message.Text = "Siga as marcas no piso até a tela azul.";
		} else if (!state.suppliesReady) {
			objective.Text = "Colete ferro e carvão";
			message.Text = "ECHO: A energia principal caiu. Abra os depósitos laterais.";
		} else if (state.structures === 0) {
			objective.Text = "Construa uma máquina";
			message.Text = "ECHO: Escolha uma máquina na barra inferior.";
		} else {
			objective.Text = "Monte sua fábrica";
			message.Text = `ECHO: ${state.structures} construções registradas.`;
		}
	}
	onState(refresh);

	const toast = label(gui, "", new UDim2(0.5, 0, 0, 12), UDim2.fromOffset(340, 34), 15, Enum.Font.GothamMedium);
	toast.Name = "Aviso";
	toast.AnchorPoint = new Vector2(0.5, 0);
	toast.BackgroundColor3 = theme.surface;
	toast.BackgroundTransparency = 0.1;
	toast.TextXAlignment = Enum.TextXAlignment.Center;
	toast.Visible = false;
	let shown = 0;
	onResult((result) => {
		if (result.reason === "OK") return;
		shown += 1;
		const id = shown;
		toast.Text = reasonText(result.reason);
		toast.Visible = true;
		task.delay(2.5, () => {
			if (id === shown) toast.Visible = false;
		});
	});
}
