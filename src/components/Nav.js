import React, { useState } from 'react';
import {
	Link,
} from "react-router-dom";

import { Logo } from './Logo'
import MenuIcon from '../img/menu.svg'

const Menu = ({ wallet }) => {

	return <ul>
		<li>
			<Link to="/">Home</Link>
		</li>
		<li>
			<Link to="/contracts">All NFTs</Link>
		</li>
		<li>
			<Link to="/offers/maker">My Offers</Link>
		</li>
		<li>
			<Link to="/offers/taker">My Tokens</Link>
		</li>
		<li>
			{
				wallet.signedIn
					?
					<Link to="/" onClick={() => wallet.signOut()}>Sign Out</Link>
					:
					<Link to="/" onClick={() => wallet.signIn()}>Sign In</Link>
			}
		</li>
	</ul>;
};

export const Nav = ({ wallet, mobile }) => {
	if (!wallet) return null;

	const [active, setActive] = useState(false);

	const handleClose = () => {
		window.scrollTo(0, 0);
		setActive(false);
	};

	return <>
		<nav className={ [mobile && 'mobile', (mobile && active).toString()].join(' ') }>
			<Link to="/" onClick={handleClose}><Logo /></Link>
			{
				mobile
					?
					<Link to="#" onClick={() => setActive(!active)}><img src={MenuIcon} /></Link>
					:
					<Menu {...{wallet}} />
			}
		</nav>
		{
			mobile && <div className={ ['mobile-menu', active].join(' ') } onClick={handleClose} >
				<Menu {...{ wallet }}/>
			</div>
		}
	</>;
};