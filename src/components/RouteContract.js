import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSupply, getTokens } from '../state/near';

const PAGE_LIMIT = 10;

export const RouteContract = ({ dispatch, tokens, supply }) => {

	if (supply === 0) supply = 30;

	const navigate = useNavigate();
	const params = useParams();
	const { contract_id } = params;

	const [state, _setState] = useState({
		index: 0
	});
	const setState = (newState) => _setState((oldState) => ({ ...oldState, ...newState }));

	const onMount = async () => {
		dispatch(getSupply(contract_id));
		dispatch(getTokens(contract_id, (state.index * PAGE_LIMIT).toString(), PAGE_LIMIT));
	};
	useEffect(onMount, []);

	const handlePage = (index) => {
		setState({ index });
		dispatch(getTokens(contract_id, (index * PAGE_LIMIT).toString(), PAGE_LIMIT));
	};

	const { index } = state;

	const cols = [], numCols = 3
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

			{state.index !== 0 && <button onClick={() => handlePage(index - 1)}>Prev</button>}
			{(index + 1) * PAGE_LIMIT < supply && <button onClick={() => handlePage(index + 1)}>Next</button>}

		</div>
	);
};
