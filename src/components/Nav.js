import React, { useState } from 'react';
import {
	Link,
} from "react-router-dom";

const Menu = ({ wallet }) => {

	return <ul>
		<li>
			<Link to="/">Home</Link>
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
	</ul>
}

export const Nav = ({ wallet, mobile }) => {
	if (!wallet) return null

	const [active, setActive] = useState(false)

	const handleClose = () => {
		setActive(false)
		window.scrollTo(0, 0)
	}

	return <>
	<nav className={ (mobile && active).toString() }>
		<ul>
			<li>
				<Link to="/" onClick={handleClose}><strong>SecondX</strong></Link>
			</li>
		</ul>
		{
			mobile
				?
				<ul>
					<li>
						<Link to="#" onClick={() => setActive(!active)}>Menu</Link>
					</li>
				</ul>
				:
				<Menu {...{wallet}} />
		}
	</nav>
	{
		mobile && <div className={ ['mobile-menu', active].join(' ') } onClick={handleClose} >
			<Menu {...{ wallet }}/>
		</div>
	}
	</>
}