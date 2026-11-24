import { acceptsItem, FUEL_CAPACITY, GENERATOR_RESTORE_COST, ITEMS, MachineType, STORAGE_CAPACITY } from "../shared/catalog";
import {
	INPUT_PREFIX,
	OUTPUT_PREFIX,
	Status,
	STOCK_PREFIX,
	STRUCTURE_ENABLED,
	STRUCTURE_ITEM,
	STRUCTURE_RESTORED,
	STRUCTURE_STATUS,
} from "../shared/protocol";
import { requestCursor } from "./camera";
import { send } from "./connection";
import { button, label, panel, scaleToFit, swatch, theme } from "./ui";
import { numberAttribute, SeenStructure } from "./world";

const STATUS_TEXT: { readonly [status in Status]: string } = {
	idle: "Pronta",
	working: "Em operação",
	off: "Desligada",
	damaged: "Danificado",
	no_fuel: "Sem combustível",
	no_power: "Sem energia",
	no_input: "Sem insumo",
	output_full: "Saída cheia",
};
const INSERT_AMOUNT = 10;

function recipeText(machine: MachineType): string {
	if (machine.id === "generator") return `Gera ${machine.supply} de energia. 1 carvão = 60 s ligado.`;
	if (machine.id === "storage") return `Capacidade total: ${STORAGE_CAPACITY} itens.`;
	if (machine.id === "belt") return "Leva um item na direção da faixa clara.";
	const recipe = machine.recipe;
	if (!recipe) return "";
	const list = (counts: { [id: string]: number | undefined }) =>
		ITEMS.filter((item) => counts[item.id] !== undefined)
			.map((item) => `${counts[item.id]} ${item.name}`)
			.join(", ");
	const inputs = list(recipe.inputs);
	return `${inputs === "" ? "Veio" : inputs} → ${list(recipe.outputs)} em ${recipe.seconds} s. Energia ${machine.power}.`;
}

export function mountInspector(gui: ScreenGui) {
	let selected: SeenStructure | undefined;
	let connections = new Array<RBXScriptConnection>();

	const frame = panel(gui, "Maquina");
	frame.AnchorPoint = new Vector2(0, 0.5);
	frame.Position = new UDim2(0, 14, 0.5, 0);
	frame.Size = UDim2.fromOffset(280, 264);
	frame.Visible = false;
	scaleToFit(frame, 700);
	const color = swatch(frame, theme.orange, UDim2.fromOffset(14, 21), 14);
	const title = label(frame, "", UDim2.fromOffset(36, 10), UDim2.fromOffset(196, 22), 20, Enum.Font.GothamBold);
	const status = label(frame, "", UDim2.fromOffset(14, 34), UDim2.fromOffset(252, 16), 13, Enum.Font.GothamMedium);
	const recipe = label(frame, "", UDim2.fromOffset(14, 54), UDim2.fromOffset(252, 34), 12, Enum.Font.Gotham, theme.muted);
	const contents = label(frame, "", UDim2.fromOffset(14, 92), UDim2.fromOffset(252, 76), 13, Enum.Font.Gotham);
	contents.TextYAlignment = Enum.TextYAlignment.Top;

	function close() {
		for (const connection of connections) connection.Disconnect();
		connections = [];
		selected = undefined;
		frame.Visible = false;
		requestCursor("inspector", false);
	}

	const closeButton = button(frame, "fechar", "X", UDim2.fromOffset(34, 30), close);
	closeButton.Position = UDim2.fromOffset(238, 8);
	const toggle = button(frame, "ligar", "", UDim2.fromOffset(122, 36), () => {
		if (!selected) return;
		if (selected.model.GetAttribute(STRUCTURE_RESTORED) !== true) {
			send({ kind: "restore", structureId: selected.id });
		} else {
			const enabled = selected.model.GetAttribute(STRUCTURE_ENABLED) !== true;
			send({ kind: "toggle", structureId: selected.id, enabled });
		}
	});
	toggle.Position = UDim2.fromOffset(14, 176);
	const take = button(frame, "retirar", "Retirar", UDim2.fromOffset(122, 36), () => {
		if (selected) send({ kind: "extract", structureId: selected.id });
	});
	take.Position = UDim2.fromOffset(144, 176);

	const inserts = ITEMS.map((item) => {
		const content = item.id === "component" ? "Comp." : item.name.split(" ")[0];
		const instance = button(frame, item.id, `+ ${content}`, UDim2.fromOffset(58, 34), () => {
			if (selected) send({ kind: "insert", structureId: selected.id, item: item.id, amount: INSERT_AMOUNT });
		});
		instance.TextSize = 11;
		return { item, instance };
	});

	function refresh() {
		if (!selected) return;
		const { model, machine } = selected;
		const current = model.GetAttribute(STRUCTURE_STATUS) as Status | undefined;
		const passive = machine.id === "belt" || machine.id === "storage";
		status.Text = passive || !current ? "" : STATUS_TEXT[current];
		status.TextColor3 = current === "working" ? theme.valid : theme.orange;

		const lines = new Array<string>();
		for (const item of ITEMS) {
			const input = numberAttribute(model, INPUT_PREFIX + item.id) ?? 0;
			const output = numberAttribute(model, OUTPUT_PREFIX + item.id) ?? 0;
			const stock = numberAttribute(model, STOCK_PREFIX + item.id) ?? 0;
			if (machine.id === "generator" && item.id === "coal") lines.push(`Combustível: ${input} / ${FUEL_CAPACITY}`);
			else if (input > 0) lines.push(`Entrada: ${input} ${item.name}`);
			if (output > 0) lines.push(`Saída: ${output} ${item.name}`);
			if (stock > 0) lines.push(`Estoque: ${stock} ${item.name}`);
			if (model.GetAttribute(STRUCTURE_ITEM) === item.id) lines.push(`Transportando: ${item.name}`);
		}
		contents.Text = lines.size() > 0 ? lines.join("\n") : "Vazia";

		const restored = model.GetAttribute(STRUCTURE_RESTORED) === true;
		toggle.Visible = !passive;
		if (!restored) toggle.Text = `Restaurar (${GENERATOR_RESTORE_COST} ferro)`;
		else toggle.Text = model.GetAttribute(STRUCTURE_ENABLED) === true ? "Desligar" : "Ligar";
	}

	function open(structure: SeenStructure) {
		close();
		selected = structure;
		title.Text = structure.machine.name;
		color.BackgroundColor3 = structure.machine.color;
		recipe.Text = recipeText(structure.machine);
		take.Visible = structure.machine.id === "storage" || structure.machine.recipe !== undefined;
		let column = 0;
		for (const { item, instance } of inserts) {
			instance.Visible = acceptsItem(structure.machine, item.id);
			instance.Position = UDim2.fromOffset(14 + column * 64, 220);
			if (instance.Visible) column += 1;
		}
		connections.push(structure.model.AttributeChanged.Connect(refresh));
		connections.push(
			structure.model.AncestryChanged.Connect(() => {
				if (!structure.model.IsDescendantOf(game)) close();
			}),
		);
		frame.Visible = true;
		requestCursor("inspector", true);
		refresh();
	}

	return { open, close };
}
