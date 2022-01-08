import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom'
import { getSupply, getTokens } from '../state/near'

const PAGE_LIMIT = 1

export const RouteContract = ({ dispatch, tokens, supply }) => {
	supply = parseInt(supply, 10)
	const params = useParams()
	const { contractId } = params

	const [state, _setState] = useState({
		index: 0
	})
	const setState = (newState) => _setState((oldState) => ({ ...oldState, ...newState }))

	const onMount = async () => {
		dispatch(getSupply(contractId))
		dispatch(getTokens(contractId, (state.index * PAGE_LIMIT).toString(), PAGE_LIMIT))
	}
	useEffect(onMount, [])

	const handlePage = (index) => {
		setState({ index })
		dispatch(getTokens(contractId, (index * PAGE_LIMIT).toString(), PAGE_LIMIT))
	}

	const { index } = state

	return (
		<div>

			<p>Page {index + 1}</p>

			{ tokens.length > 0 && <>
				<img src={tokens[0].metadata.media} />

			<p>Raw Data { JSON.stringify(tokens) }</p>

			</>}
			{ state.index !== 0 && <button onClick={() => handlePage(index - 1)}>Prev</button>}
			{ (index + 1) * PAGE_LIMIT < supply && <button onClick={() => handlePage(index + 1)}>Next</button>}

		</div>
	);
};
