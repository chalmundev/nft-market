import React from 'react';

import { Rows } from './Rows';

export const Page = ({ update, index, supply, arr, width, handlePage, pageSize, loading, Item }) => {

	return <>
		<p>Page {index+1} / {Math.ceil(supply / pageSize)}</p>

		<div className='grid apart-2'>
			{index !== 0 ? <button onClick={() => handlePage(index - 1)}>Prev</button> : <button style={{ visibility: 'hidden' }}></button>}
			{(index + 1) * pageSize < supply ? <button onClick={() => handlePage(index + 1)}>Next</button> : <button style={{ visibility: 'hidden' }}></button>}
		</div>
		
		{ !loading && <Rows {...{ width, arr, Item }} /> }
	</>;
};