const soundService = game.GetService("SoundService");

/** Somente sons que acompanham o próprio cliente Roblox: nenhum asset externo. */
const FILES = {
	hit: "rbxasset://sounds/action_footsteps_plastic.mp3",
	breakRock: "rbxasset://sounds/impact_explosion_03.mp3",
	land: "rbxasset://sounds/action_jump_land.mp3",
	jump: "rbxasset://sounds/action_jump.mp3",
	click: "rbxasset://sounds/volume_slider.ogg",
};

export type SoundId = keyof typeof FILES;

export function playSound(id: SoundId, volume: number, speed = 1, seconds?: number) {
	const sound = new Instance("Sound");
	sound.SoundId = FILES[id];
	sound.Volume = volume;
	sound.PlaybackSpeed = speed;
	sound.Parent = soundService;
	sound.Play();
	task.delay(seconds ?? 2, () => sound.Destroy());
}
