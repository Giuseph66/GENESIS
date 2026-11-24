import "./loading";
import { BOOTSTRAP_REVISION, PROJECT_NAME } from "../shared/bootstrap";
import { mountBelts } from "./belts";
import { mountBuilder } from "./builder";
import { mountCamera, toggleCamera } from "./camera";
import { mountCombat } from "./combat";
import { requestState } from "./connection";
import { mountDialogue } from "./dialogue";
import { mountDock } from "./dock";
import { mountEcho } from "./echo";
import { mountEffects } from "./effects";
import { mountExpedition } from "./expedition";
import { mountHelp } from "./help";
import { mountHud } from "./hud";
import { mountJournal } from "./journal";
import { mountMachines } from "./machines";
import { mountMarkers } from "./markers";
import { mountMining } from "./mining";
import { mountMovement } from "./movement";
import { mountParty } from "./party";
import { mountTool } from "./tool";

const player = game.GetService("Players").LocalPlayer;
const gui = new Instance("ScreenGui");
gui.Name = "GenesisHud";
gui.ResetOnSpawn = false;
gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
gui.Parent = player.WaitForChild("PlayerGui");
// O painel do projeto ocupa o canto da lista de jogadores.
game.GetService("StarterGui").SetCoreGuiEnabled(Enum.CoreGuiType.PlayerList, false);

mountCamera(gui);
mountEffects(gui);
mountMovement(gui);
const hud = mountHud(gui);
const builder = mountBuilder(gui, hud.showToast);
mountMining(gui, mountTool(), builder.isBusy);
mountMarkers(gui);
mountBelts();
mountMachines();
const dialogue = mountDialogue(gui, mountEcho().speak);
const journal = mountJournal(gui);
const party = mountParty(gui);
const help = mountHelp(gui);
mountDock(gui, [
	{ name: "construir", key: "B", text: "Construir", run: builder.toggle, baseOnly: true },
	{ name: "echo", key: "T", text: "Falar com ECHO", run: dialogue.ask },
	{ name: "diario", key: "J", text: "Diário", run: journal.toggle },
	{ name: "grupo", key: "P", text: "Grupo", run: party.toggle },
	{ name: "camera", key: "V", text: "Câmera", run: toggleCamera },
	{ name: "ajuda", key: "H", text: "Ajuda", run: help.toggle },
]);
task.spawn(() => mountCombat(gui));
task.spawn(() => mountExpedition(gui));
requestState();
print(`[${PROJECT_NAME}] Cliente inicializado (${BOOTSTRAP_REVISION}).`);
