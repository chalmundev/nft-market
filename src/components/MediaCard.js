import React from 'react';
import {
	Link,
} from "react-router-dom";
import { Media } from './Media';
import '../css/Features.scss';

export const MediaCard = ({ title, subtitle, link, media, classNames = [], useCanvas }) => {

	return <Link to={link} className={classNames.join(' ')}>
		<div>
			<div>
				<Media {...{ media, useCanvas }} />
				{ title && <h3>{title}</h3> }
				{subtitle && <p>{subtitle}</p>}
			</div>
		</div>
	</Link>;
};