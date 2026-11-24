import { BOOTSTRAP_REVISION, PROJECT_NAME } from "../shared/bootstrap";
import { mountBuilder } from "./builder";
import { requestState } from "./connection";
import { mountHud } from "./hud";

const player = game.GetService("Players").LocalPlayer;
const gui = new Instance("ScreenGui");
gui.Name = "GenesisHud";
gui.ResetOnSpawn = false;
gui.Parent = player.WaitForChild("PlayerGui");

mountHud(gui);
mountBuilder(gui);
requestState();
print(`[${PROJECT_NAME}] Cliente inicializado (${BOOTSTRAP_REVISION}).`);
