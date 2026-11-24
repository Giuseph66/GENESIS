export const theme = {
	surface: Color3.fromRGB(21, 24, 29),
	group: Color3.fromRGB(48, 55, 64),
	line: Color3.fromRGB(73, 83, 94),
	text: Color3.fromRGB(228, 232, 237),
	muted: Color3.fromRGB(169, 183, 199),
	orange: Color3.fromRGB(255, 150, 51),
	cyan: Color3.fromRGB(56, 201, 232),
	valid: Color3.fromRGB(88, 214, 120),
	invalid: Color3.fromRGB(236, 84, 84),
};

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
	instance.Font = font;
	instance.Text = content;
	instance.TextSize = textSize;
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
	frame.BackgroundTransparency = 0.08;
	frame.BorderSizePixel = 0;
	const stroke = new Instance("UIStroke");
	stroke.Color = theme.line;
	stroke.Parent = frame;
	frame.Parent = parent;
	return frame;
}

export function button(parent: Instance, name: string, content: string, size: UDim2, onActivated: () => void): TextButton {
	const instance = new Instance("TextButton");
	instance.Name = name;
	instance.AutoButtonColor = true;
	instance.BackgroundColor3 = theme.group;
	instance.BorderSizePixel = 0;
	instance.Size = size;
	instance.Font = Enum.Font.GothamMedium;
	instance.Text = content;
	instance.TextSize = 13;
	instance.TextColor3 = theme.text;
	instance.TextWrapped = true;
	const corner = new Instance("UICorner");
	corner.CornerRadius = new UDim(0, 4);
	corner.Parent = instance;
	instance.Activated.Connect(onActivated);
	instance.Parent = parent;
	return instance;
}

/** Reduz a interface em telas estreitas. */
export function scaleToFit(target: GuiObject, designWidth: number) {
	const scale = new Instance("UIScale");
	scale.Parent = target;
	const workspace = game.GetService("Workspace");
	function refresh() {
		const width = workspace.CurrentCamera?.ViewportSize.X ?? designWidth;
		scale.Scale = math.clamp(width / designWidth, 0.6, 1);
	}
	workspace.CurrentCamera?.GetPropertyChangedSignal("ViewportSize").Connect(refresh);
	refresh();
}
