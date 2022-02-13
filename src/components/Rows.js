import React from 'react';

export const Rows = ({ arr, Item, width = window.innerWidth / 2 }) => {
	const rows = [], numCols = Math.ceil(window.innerWidth / width);
	for (let i = 0; i < arr.length; i += numCols) {
		const slice = arr.slice(i, i + numCols);
		while (slice.length < numCols) slice.push(null);
		rows.push(slice);
	}

	return rows.map((row, i) => {
		return <div className="grid" key={i}>
			{
				row.map((props, j) => {
					return props ? <Item key={j} {...{ ...props, i: i*row.length + j } } /> : <div key={j}></div>
				})
			}
		</div>
	})
};