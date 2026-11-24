/*
 * Carrega os módulos de domínio TypeScript em Node, com o mínimo das APIs de Luau e Roblox simulado.
 * Cobre regras puras. Comportamento do motor continua exigindo teste no Studio.
 */
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

Array.prototype.size = function () {
	return this.length;
};
const nativeSort = Array.prototype.sort;
Array.prototype.sort = function (less) {
	// Em Luau o comparador devolve booleano.
	return nativeSort.call(this, less && ((a, b) => (less(a, b) ? -1 : less(b, a) ? 1 : 0)));
};

class Vector3 {
	constructor(x, y, z) {
		Object.assign(this, { X: x, Y: y, Z: z });
	}
}
Object.assign(globalThis, {
	math: {
		floor: Math.floor,
		round: Math.round,
		min: Math.min,
		max: Math.max,
		abs: Math.abs,
		huge: Infinity,
		pi: Math.PI,
		rad: (degrees) => (degrees * Math.PI) / 180,
		cos: Math.cos,
		sin: Math.sin,
		sqrt: Math.sqrt,
	},
	Vector3,
	Color3: { fromRGB: (...rgb) => ({ rgb }) },
	pairs: (value) => Object.entries(value),
	pcall: (callback) => {
		try {
			return [true, callback()];
		} catch (problem) {
			return [false, problem];
		}
	},
	os: { clock: () => 0 },
	tostring: String,
	$tuple: (...values) => values,
	typeIs: (value, type) => (type === "table" ? typeof value === "object" && value !== null : typeof value === type),
	assert: (condition, message) => {
		if (!condition) throw new Error(message);
	},
	game: { GetService: () => ({ JSONEncode: JSON.stringify, JSONDecode: JSON.parse }) },
});

/** Em roblox-ts, `size` é chamado como método. As subclasses evitam alterar o Map do próprio Node. */
const count = (native, value) => Object.getOwnPropertyDescriptor(native.prototype, "size").get.call(value);
class LuaMap extends Map {}
class LuaSet extends Set {}
Object.defineProperty(LuaMap.prototype, "size", { value: function () { return count(Map, this); } });
Object.defineProperty(LuaSet.prototype, "size", { value: function () { return count(Set, this); } });

const root = path.resolve(__dirname, "../src");
const cache = new Map();

function load(file) {
	const full = path.resolve(root, file);
	if (cache.has(full)) return cache.get(full);
	const exported = {};
	cache.set(full, exported);
	const options = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 };
	const { outputText } = ts.transpileModule(fs.readFileSync(`${full}.ts`, "utf8"), { compilerOptions: options });
	const resolve = (request) => load(path.resolve(path.dirname(full), request));
	new Function("exports", "require", "Map", "Set", outputText)(exported, resolve, LuaMap, LuaSet);
	return exported;
}

module.exports = { load };
