import { useState } from 'react';

export const get = (k) => {
	const v = localStorage.getItem(k);
	if (v.charAt(0) !== '{') {
		return v
	}
	try {
		return JSON.parse(v);
	} catch (e) {
		console.warn(e)
	}
};
export const set = (k, v) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
export const del = (k) => localStorage.removeItem(k);

export const useStore = (key, def) => {
	const [val, setVal] = useState(get(key) || def);
	
	const _setVal = (newVal) => {
		set(key, newVal)
		setVal(newVal)
	}
  
	return [val, _setVal]
}