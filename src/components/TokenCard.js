import React from 'react';

import { TokenMedia } from './TokenMedia';
import '../css/Token.scss';

export const TokenCard = ({ token }) => {
	if (!token) return null
	
	const { metadata: { media } } = token

	return <div className='token-card'>

		<div>
			<div>
				<TokenMedia {...{media}} />
			</div>
		</div>

	</div>;
};