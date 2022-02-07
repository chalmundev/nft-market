import React from 'react';

import { Media } from './Media';
import '../css/Features.scss';

export const TokenFeatured = ({ contract, token }) => {
	if (!token) return null

	const { metadata: { media } } = token

	return <div className='token-featured'>

		<Media {...{media}} />

		<h2>{ contract.name }</h2>

	</div>;
};