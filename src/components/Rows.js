import React from 'react';

export const Rows = ({ arr, Item, width = 375 }) => {
	const rows = [], numCols = Math.ceil(window.innerWidth / width);
	for (let i = 0; i < arr.length; i += numCols) {
		const slice = arr.slice(i, i + numCols);
		while (slice.length < numCols) slice.push(null);
		rows.push(slice);
	}

	return rows.map((row, i) => <div className="grid" key={i}>
		{
			row.map((props, j) => props ? <Item key={j} {...props} /> : <div key={j}></div>)
		}
	</div>);
};