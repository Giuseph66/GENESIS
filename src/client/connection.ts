import {
	Command,
	COMMAND_REMOTE,
	CommandResult,
	PlayerState,
	REMOTES_FOLDER,
	RESULT_REMOTE,
	STATE_REMOTE,
} from "../shared/protocol";

const folder = game.GetService("ReplicatedStorage").WaitForChild(REMOTES_FOLDER);
const commandRemote = folder.WaitForChild(COMMAND_REMOTE) as RemoteEvent<(command: Command) => void>;
const resultRemote = folder.WaitForChild(RESULT_REMOTE) as RemoteEvent<(result: CommandResult) => void>;
const stateRemote = folder.WaitForChild(STATE_REMOTE) as RemoteEvent<(state: PlayerState) => void>;

type BuildCommand = Extract<Command, { kind: "build" }>;

const stateListeners = new Array<(state: PlayerState) => void>();
const resultListeners = new Array<(result: CommandResult) => void>();
let current: PlayerState | undefined;
let nextRequestId = 1;

stateRemote.OnClientEvent.Connect((state) => {
	if (current && state.revision <= current.revision) return;
	current = state;
	for (const listener of stateListeners) listener(state);
});
resultRemote.OnClientEvent.Connect((result) => {
	for (const listener of resultListeners) listener(result);
});

export function getState(): PlayerState | undefined {
	return current;
}

export function onState(listener: (state: PlayerState) => void) {
	stateListeners.push(listener);
	if (current) listener(current);
}

export function onResult(listener: (result: CommandResult) => void) {
	resultListeners.push(listener);
}

export function sendBuild(command: Omit<BuildCommand, "kind" | "requestId">) {
	commandRemote.FireServer({
		kind: "build",
		requestId: nextRequestId++,
		machine: command.machine,
		cx: command.cx,
		cz: command.cz,
		rotation: command.rotation,
	});
}

export function sendRemove(structureId: number) {
	commandRemote.FireServer({ kind: "remove", requestId: nextRequestId++, structureId });
}

export function requestState() {
	commandRemote.FireServer({ kind: "sync" });
}
