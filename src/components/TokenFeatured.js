import React from 'react';

import { TokenMedia } from './TokenMedia';
import '../css/Token.scss';

export const TokenFeatured = ({ contract, token }) => {
	if (!token) return null

	const { metadata: { media } } = token

	return <div className='token-featured'>

		<TokenMedia {...{media}} />

		<h2>{ contract.name }</h2>

	</div>;
};