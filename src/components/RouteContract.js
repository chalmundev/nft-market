import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchContract } from '../state/near';

const PAGE_LIMIT = 3;

export const RouteContract = ({ dispatch, update, contractId, index, supply, tokens }) => {

	const navigate = useNavigate();
	const params = useParams();
	const { contract_id } = params;

	const onMount = async () => {
		if (contractId === contract_id) {
			return
		}
		await handlePage(index)
		await update('data.contractId', contract_id)
	};
	useEffect(onMount, []);

	const handlePage = async (_index) => {
		console.log(index, _index)
		if (index !== _index) {
			update('data.index', _index)
		}
		await dispatch(fetchContract(contract_id, {
			from_index: (parseInt(_index, 10) * PAGE_LIMIT).toString(),
			limit: PAGE_LIMIT,
		}))
	};

	const cols = [], numCols = Math.ceil(window.innerWidth / 500)
	for (let i = 0; i < tokens.length; i += numCols) {
		cols.push(tokens.slice(i, i + numCols))
	}

	return (
		<div>

			<p>Page {index + 1}</p>

			{
				cols.map((col, i) => <div className="grid" key={i}>
					{
						col.map(({ token_id, metadata }) => <div key={token_id} onClick={() => navigate(`/token/${contract_id}/${token_id}`)}>
							<img src={metadata.media} />
							<p>{token_id}</p>
						</div>)
					}
				</div>)
			}

			<div className='button-row'>
				{index !== 0 && <button onClick={() => handlePage(index - 1)}>Prev</button>}
				{(index + 1) * PAGE_LIMIT < supply && <button onClick={() => handlePage(index + 1)}>Next</button>}
			</div>

		</div>
	);
};
