'use strict'
let path=module.exports;

path.join=function(...args){
	return __path_normalize(args.join('/'));
}

path.resolve=function(...args){
	return __path_toAbsolute(args.join('/'));
}

path.parse=function(s){
	return JSON.parse(__path_parse(s));
}