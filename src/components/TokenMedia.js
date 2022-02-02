import React from 'react';

import Missing from './../img/missing.jpg';

export const TokenMedia = ({ media }) => {

	return <div className='token-image'>

		<img
			src={media ? media : Missing}
			onError={({ currentTarget }) => {
				currentTarget.onerror = null;
				currentTarget.src = Missing;
			}}
		/>

	</div>;
};