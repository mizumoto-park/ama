'use strict';
//@ama ParseCurrentFile().then(require("jcs").TranslateJCS)
const fs = require('fs');
const path = require('path');
const assert = require('assert');
let depends = module.exports;

depends.c_include_paths = (process.env.INCLUDE || '').split(process.platform == 'win32' ? ';' : ':').filter(s=> s);

depends.Resolve = function(nd) {
	assert(nd.node_class == N_DEPENDENCY);
	if ((nd.flags & DEP_TYPE_MASK) == DEP_C_INCLUDE) {
		let fn = nd.c.GetStringValue()
		if(nd.flags & DEPF_C_INCLUDE_NONSTR) {
			fn = fn.replace(new RegExp('[<>]', 'g'), '');
		}
		if (!(nd.flags & DEPF_C_INCLUDE_NONSTR)) {
			let fn_test = path.resolve(path.dirname(nd.Root().data), fn);
			if (fs.existsSync(fn_test)) {
				return fn_test;
			}
		}
		for (let dir of depends.c_include_paths) {
			let fn_test = path.resolve(dir, fn)
			if (fs.existsSync(fn_test)) {
				return fn_test;
			}
		}
	} else if((nd.flags & DEP_TYPE_MASK) == DEP_JS_REQUIRE) {
		//reuse the builtin searcher __ResolveJSRequire
		if (nd.c && nd.c.node_class == N_STRING) {
			return __ResolveJSRequire(__filename, nd.c.GetStringValue);
		}
	}
	return undefined;
}

depends.cache = new Map();
depends.LoadFile = function(fn) {
	fn = __path_toAbsolute(fn);
	let nd_cached = depends.cache.get(fn);
	if (!nd_cached) {
		let data = null
		try {
			data = fs.readFileSync(fn);
		} catch (err) {
			//do nothing
		}
		if (!data) {return null;}
		nd_cached = ParseCode(data, __PrepareOptions(fn));
		nd_cached.data = fn;
		depends.cache.set(fn, nd_cached);
	}
	return nd_cached;
}

let nd_add_template = .{#pragma add(.(Node.MatchAny(N_STRING, 'kind')), .(Node.MatchAny(N_STRING, 'name')))};
depends.dependency_cache = [new Map(), new Map()];
depends.ListAllDependency = function(nd_root, include_system_headers) {
	let cache = depends.dependency_cache[0 | !!include_system_headers];
	if (cache.get(nd_root)) {
		return cache.get(nd_root);
	}
	let ret = new Set();
	let Q = [nd_root];
	for (let qi = 0; qi < Q.length; qi++) {
		let nd_root = Q[qi];
		for (let ndi of nd_root.FindAll(N_DEPENDENCY, null)) {
			if (!include_system_headers && (ndi.flags & DEP_TYPE_MASK) == DEP_C_INCLUDE && ( ndi.flags & DEPF_C_INCLUDE_NONSTR )) {
				continue;
			}
			let fn_dep = depends.Resolve(ndi);
			if (fn_dep && !ret.has(fn_dep)) {
				ret.add(fn_dep);
				let nd_root_dep = depends.LoadFile(fn_dep)
				if (nd_root_dep) {
					Q.push(nd_root_dep);
				}
			}
		}
		for (let match of nd_root.MatchAll(nd_add_template)) {
			if (!match.kind.GetStringValue().endsWith('_files')) {continue;}
			let fn_dep = path.resolve(path.dirname(nd_root.data), match.name.GetStringValue());
			if (fs.existsSync(fn_dep) ) {
				if (!ret.has(fn_dep)) {
					ret.add(fn_dep);
					let ext = path.extname(fn_dep);
					if (ext != '.a' && ext != '.so' && ext != '.dll') {
						let nd_root_dep = depends.LoadFile(fn_dep);
						if (nd_root_dep) {
							Q.push(nd_root_dep);
						}
					}
				}
			} else {
				console.error('unable to find', fn_dep);
			}
		}
	}
	let qret = Q.map(ndi=>__path_toAbsolute(ndi.data));
	cache.set(nd_root, qret);
	return qret;
}

depends.ListLoadedFiles = function() {
	let ret = [];
	for (let name in __require_cache) {
		ret.push(path.resolve(name));
	}
	depends.cache.forEach((nd_root, name)=> {
		ret.push(path.resolve(name));
	});
	return ret;
}
