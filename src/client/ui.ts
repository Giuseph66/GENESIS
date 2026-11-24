const workspace = game.GetService("Workspace");

/** Paleta do GDD. Laranja é ação e perigo; ciano, energia. */
export const theme = {
	surface: Color3.fromRGB(21, 24, 29),
	raised: Color3.fromRGB(35, 40, 48),
	group: Color3.fromRGB(48, 55, 64),
	line: Color3.fromRGB(64, 73, 84),
	text: Color3.fromRGB(228, 232, 237),
	muted: Color3.fromRGB(154, 168, 184),
	orange: Color3.fromRGB(255, 150, 51),
	cyan: Color3.fromRGB(56, 201, 232),
	valid: Color3.fromRGB(88, 214, 120),
	invalid: Color3.fromRGB(236, 84, 84),
};

const DISPLAY = "rbxasset://fonts/families/Sarpanch.json";
const BODY = "rbxasset://fonts/families/TitilliumWeb.json";
/** Titillium é mais estreita que a Gotham que substitui. */
const BODY_BOOST = 1;
const RADIUS = 6;

/** Títulos e números usam Sarpanch; o resto, Titillium Web. Ambas acompanham o cliente Roblox. */
export function fontFor(font: Enum.Font, size: number): Font {
	if (font === Enum.Font.GothamBold && size >= 17) return new Font(DISPLAY, Enum.FontWeight.Bold);
	if (font === Enum.Font.GothamBold) return new Font(BODY, Enum.FontWeight.Bold);
	if (font === Enum.Font.GothamMedium) return new Font(BODY, Enum.FontWeight.SemiBold);
	return new Font(BODY, Enum.FontWeight.Regular);
}

export function displayFont(weight: Enum.FontWeight = Enum.FontWeight.Bold): Font {
	return new Font(DISPLAY, weight);
}

function corner(target: GuiObject, radius = RADIUS) {
	const instance = new Instance("UICorner");
	instance.CornerRadius = new UDim(0, radius);
	instance.Parent = target;
}

function stroke(target: GuiObject, color: Color3, transparency = 0) {
	const instance = new Instance("UIStroke");
	instance.Color = color;
	instance.Transparency = transparency;
	instance.ApplyStrokeMode = Enum.ApplyStrokeMode.Border;
	instance.Parent = target;
	return instance;
}

export function label(
	parent: Instance,
	content: string,
	position: UDim2,
	size: UDim2,
	textSize: number,
	font: Enum.Font,
	color = theme.text,
): TextLabel {
	const instance = new Instance("TextLabel");
	instance.BackgroundTransparency = 1;
	instance.Position = position;
	instance.Size = size;
	instance.FontFace = fontFor(font, textSize);
	instance.Text = content;
	instance.TextSize = textSize >= 17 && font === Enum.Font.GothamBold ? textSize : textSize + BODY_BOOST;
	instance.TextColor3 = color;
	instance.TextXAlignment = Enum.TextXAlignment.Left;
	instance.TextWrapped = true;
	instance.Parent = parent;
	return instance;
}

export function panel(parent: Instance, name: string): Frame {
	const frame = new Instance("Frame");
	frame.Name = name;
	frame.BackgroundColor3 = theme.surface;
	frame.BackgroundTransparency = 0.06;
	frame.BorderSizePixel = 0;
	corner(frame);
	stroke(frame, theme.line, 0.25);
	frame.Parent = parent;
	return frame;
}

export function button(parent: Instance, name: string, content: string, size: UDim2, onActivated: () => void): TextButton {
	const instance = new Instance("TextButton");
	instance.Name = name;
	instance.AutoButtonColor = true;
	instance.BackgroundColor3 = theme.raised;
	instance.BorderSizePixel = 0;
	instance.Size = size;
	instance.FontFace = new Font(BODY, Enum.FontWeight.SemiBold);
	instance.Text = content;
	instance.TextSize = 14;
	instance.TextColor3 = theme.text;
	instance.TextWrapped = true;
	corner(instance, 5);
	stroke(instance, theme.line, 0.35);
	instance.Activated.Connect(onActivated);
	instance.Parent = parent;
	return instance;
}

/** Destaca a opção escolhida pela borda, sem trocar a cor do texto. */
export function setSelected(target: GuiButton, selected: boolean) {
	target.BackgroundColor3 = selected ? Color3.fromRGB(58, 44, 30) : theme.raised;
	const border = target.FindFirstChildOfClass("UIStroke");
	if (border) {
		border.Color = selected ? theme.orange : theme.line;
		border.Transparency = selected ? 0 : 0.35;
		border.Thickness = selected ? 2 : 1;
	}
}

/** Tecla em um quadrado, como na tampa do teclado. */
export function keyBadge(parent: Instance, key: string, position: UDim2): TextLabel {
	const badge = new Instance("TextLabel");
	badge.Name = "Tecla";
	badge.AnchorPoint = new Vector2(0, 0.5);
	badge.Position = position;
	badge.Size = UDim2.fromOffset(math.max(22, key.size() * 9 + 10), 22);
	badge.BackgroundColor3 = theme.surface;
	badge.FontFace = displayFont();
	badge.Text = key;
	badge.TextSize = 14;
	badge.TextColor3 = theme.orange;
	corner(badge, 4);
	stroke(badge, theme.orange, 0.55);
	badge.Parent = parent;
	return badge;
}

/** Botão com selo de tecla à esquerda e rótulo. */
export function keyButton(parent: Instance, name: string, key: string, text: string, size: UDim2, onActivated: () => void) {
	const instance = button(parent, name, "", size, onActivated);
	keyBadge(instance, key, new UDim2(0, 8, 0.5, 0));
	const caption = label(instance, text, UDim2.fromOffset(key.size() * 9 + 26, 0), new UDim2(1, -(key.size() * 9 + 30), 1, 0), 14, Enum.Font.GothamMedium);
	caption.TextWrapped = false;
	caption.TextTruncate = Enum.TextTruncate.AtEnd;
	return instance;
}

export function swatch(parent: Instance, color: Color3, position: UDim2, size = 12): Frame {
	const frame = new Instance("Frame");
	frame.Name = "Cor";
	frame.AnchorPoint = new Vector2(0, 0.5);
	frame.Position = position;
	frame.Size = UDim2.fromOffset(size, size);
	frame.BackgroundColor3 = color;
	frame.BorderSizePixel = 0;
	corner(frame, 3);
	stroke(frame, Color3.fromRGB(0, 0, 0), 0.6);
	frame.Parent = parent;
	return frame;
}

/** Barra de progresso. Devolve o preenchimento, cuja escala X é a fração. */
export function bar(parent: Instance, position: UDim2, size: UDim2, color: Color3): Frame {
	const track = new Instance("Frame");
	track.Name = "Barra";
	track.Position = position;
	track.Size = size;
	track.BackgroundColor3 = theme.group;
	track.BorderSizePixel = 0;
	corner(track, 3);
	track.Parent = parent;
	const fill = new Instance("Frame");
	fill.Name = "Preenchimento";
	fill.Size = UDim2.fromScale(0, 1);
	fill.BackgroundColor3 = color;
	fill.BorderSizePixel = 0;
	corner(fill, 3);
	fill.Parent = track;
	return fill;
}

/** Faixa de sinalização industrial. É o único ornamento da interface. */
export function hazardBand(parent: Instance, height: number): TextLabel {
	const band = new Instance("TextLabel");
	band.Name = "Faixa";
	band.Size = new UDim2(1, 0, 0, height);
	band.BackgroundColor3 = theme.orange;
	band.BorderSizePixel = 0;
	band.FontFace = displayFont(Enum.FontWeight.Heavy);
	band.Text = string.rep("/", 80);
	band.TextSize = height + 6;
	band.TextColor3 = theme.surface;
	band.TextTransparency = 0.55;
	band.TextXAlignment = Enum.TextXAlignment.Left;
	band.ClipsDescendants = true;
	corner(band, RADIUS);
	band.Parent = parent;
	return band;
}

/** Reduz a interface em telas estreitas. */
export function scaleToFit(target: GuiObject, designWidth: number) {
	const scale = new Instance("UIScale");
	scale.Parent = target;
	function refresh() {
		const width = workspace.CurrentCamera?.ViewportSize.X ?? designWidth;
		scale.Scale = math.clamp(width / designWidth, 0.6, 1);
	}
	workspace.CurrentCamera?.GetPropertyChangedSignal("ViewportSize").Connect(refresh);
	refresh();
}
