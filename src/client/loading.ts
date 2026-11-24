import { WORLD_STATUS } from "../shared/protocol";

const players = game.GetService("Players");
const workspace = game.GetService("Workspace");

const DISPLAY = "rbxasset://fonts/families/Sarpanch.json";
const BODY = "rbxasset://fonts/families/TitilliumWeb.json";

const gui = new Instance("ScreenGui");
gui.Name = "GenesisLoading";
gui.IgnoreGuiInset = true;
gui.DisplayOrder = 50;
gui.ResetOnSpawn = false;
const screen = new Instance("Frame");
screen.Size = UDim2.fromScale(1, 1);
screen.BackgroundColor3 = Color3.fromRGB(21, 24, 29);
screen.Parent = gui;
const title = new Instance("TextLabel");
title.AnchorPoint = new Vector2(0.5, 1);
title.Position = UDim2.fromScale(0.5, 0.5);
title.Size = UDim2.fromOffset(700, 70);
title.BackgroundTransparency = 1;
title.FontFace = new Font(DISPLAY, Enum.FontWeight.Bold);
title.Text = "Project Genesis";
title.TextSize = 56;
title.TextColor3 = Color3.fromRGB(228, 232, 237);
title.Parent = screen;
const band = new Instance("Frame");
band.AnchorPoint = new Vector2(0.5, 0);
band.Position = new UDim2(0.5, 0, 0.5, 8);
band.Size = UDim2.fromOffset(120, 4);
band.BackgroundColor3 = Color3.fromRGB(255, 150, 51);
band.BorderSizePixel = 0;
band.Parent = screen;
const text = new Instance("TextLabel");
text.AnchorPoint = new Vector2(0.5, 0);
text.Position = new UDim2(0.5, 0, 0.5, 28);
text.Size = UDim2.fromOffset(640, 60);
text.BackgroundTransparency = 1;
text.FontFace = new Font(BODY, Enum.FontWeight.Regular);
text.TextSize = 20;
text.TextColor3 = Color3.fromRGB(154, 168, 184);
text.TextWrapped = true;
text.Parent = screen;
gui.Parent = players.LocalPlayer.WaitForChild("PlayerGui");

function refresh() {
	const status = workspace.GetAttribute(WORLD_STATUS);
	const message = typeIs(status, "string") ? status : "Conectando…";
	text.Text = message;
	gui.Enabled = message !== "";
}
workspace.GetAttributeChangedSignal(WORLD_STATUS).Connect(refresh);
refresh();

export {};
