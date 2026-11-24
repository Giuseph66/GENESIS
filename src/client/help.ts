import { requestCursor } from "./camera";
import { button, label, panel, scaleToFit, theme } from "./ui";

const input = game.GetService("UserInputService");

interface Section {
	readonly title: string;
	readonly lines: ReadonlyArray<string>;
}

const SECTIONS: ReadonlyArray<Section> = [
	{
		title: "Andar e olhar",
		lines: [
			"WASD anda · Espaço pula · Shift corre",
			"V troca entre primeira e terceira pessoa",
			"Tab solta ou prende o mouse na primeira pessoa",
		],
	},
	{
		title: "Minerar e usar",
		lines: [
			"Segure E perto de um depósito ou jazida para minerar",
			"Na primeira pessoa, segurar o clique também minera",
			"E perto do terminal pesquisa. Na porta, inicia a expedição",
		],
	},
	{
		title: "Construir",
		lines: [
			"B abre a câmera de drone. 1 a 5 escolhem a máquina",
			"Scroll ou R gira. A placa SAÍDA mostra para onde os itens vão",
			"A placa fica verde quando a ligação com a máquina vizinha está certa",
			"Esteira: clique e arraste para fazer a linha inteira",
			"WASD move o drone · Ctrl + scroll aproxima · botão direito gira a vista",
			"M move · X remove e devolve tudo · Q volta",
		],
	},
	{
		title: "Linha de suprimento",
		lines: [
			"1. Clique no gerador: restaure e ponha carvão",
			"2. Mineradora sobre o veio marrom, com a SAÍDA para fora",
			"3. Esteiras → fornalha → esteiras → montadora → esteiras → armazém",
			"Luz verde: operando · amarela: falta item ou saída cheia · vermelha: sem energia",
		],
	},
	{
		title: "Combate na expedição",
		lines: ["Clique ataca · F dispara a descarga · Q esquiva", "Vermelho no chão é o golpe que vem. Saia antes", "1, 2 ou 3 escolhe a melhoria"],
	},
];

const LINE_HEIGHT = 19;
const TITLE_HEIGHT = 26;

/** Ajuda completa, aberta pelo botão do menu ou por H. */
export function mountHelp(gui: ScreenGui) {
	const frame = panel(gui, "Ajuda");
	frame.AnchorPoint = new Vector2(0.5, 0.5);
	frame.Position = UDim2.fromScale(0.5, 0.48);
	frame.BackgroundTransparency = 0.03;
	frame.Visible = false;
	frame.ZIndex = 20;
	scaleToFit(frame, 640);
	label(frame, "Ajuda", UDim2.fromOffset(20, 12), UDim2.fromOffset(300, 26), 22, Enum.Font.GothamBold);

	let y = 46;
	for (const section of SECTIONS) {
		label(frame, section.title, UDim2.fromOffset(20, y), UDim2.fromOffset(520, 20), 15, Enum.Font.GothamBold, theme.orange);
		y += TITLE_HEIGHT - 4;
		for (const line of section.lines) {
			label(frame, line, UDim2.fromOffset(20, y), UDim2.fromOffset(540, 17), 14, Enum.Font.Gotham);
			y += LINE_HEIGHT;
		}
		y += 8;
	}
	frame.Size = UDim2.fromOffset(580, y + 8);

	function toggle() {
		frame.Visible = !frame.Visible;
		requestCursor("help", frame.Visible);
	}
	button(frame, "fechar", "X", UDim2.fromOffset(34, 30), toggle).Position = new UDim2(1, -46, 0, 10);
	input.InputBegan.Connect((event, processed) => {
		if (!processed && event.KeyCode === Enum.KeyCode.H) toggle();
	});
	return { toggle };
}
