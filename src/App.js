import React, { useContext, useEffect } from 'react';
import {
	Routes,
	Route,
	Link,
	useNavigate
} from "react-router-dom";

import data from '../static/data.json';
import { appStore, onAppMount } from './state/app';

import { RouteContract } from './components/RouteContract';
import { RouteToken } from './components/RouteToken';

import './App.scss';

const App = () => {
	const { state, dispatch, update } = useContext(appStore);

	console.log('state', state);

	const navigate = useNavigate();

	const { wallet, account } = state;

	const onMount = () => {
		dispatch(onAppMount('world'));
	};
	useEffect(onMount, []);

	const handleClick = () => {
		update('clicked', !state.clicked);
	};

	const { tokens, supply } = state.data;

	return (
		<main className="container-fluid">

			<nav>
				<ul>
					<li>
						<strong>Brand</strong>
					</li>
					<li>
						<Link to="/">Home</Link>
					</li>
				</ul>
				<ul>
					<li>
						<Link to="/account">Wallet</Link>
					</li>
				</ul>
			</nav>

			<Routes>
				<Route path="/contract/:contract_id" element={
					<RouteContract {...{ dispatch, tokens, supply }} />
				} />

				<Route path="/token/:contract_id/:token_id" element={
					<RouteToken {...{ tokens }} />
				} />

				<Route path="/account" element={
					account ? <>
						<p>{account.accountId}</p>
						<button onClick={() => wallet.signOut()}>Sign Out</button>
					</> :
						<>
							<p>Not Signed In</p>
							<button onClick={() => wallet.signIn()}>Sign In</button>
						</>
				} />

				<Route path="/" element={
					data
						.filter(({ contract_id, name }) => /loot/gi.test(name) || contract_id === 'tests.nft-market.testnet')
						.map(({ contract_id, ts, name }) => {
						return <div key={contract_id} onClick={() => navigate('/contract/' + contract_id)}>
							{name} - {contract_id} - {ts}
						</div>;
					})
				} />
			</Routes>

		</main>
	);
};

export default App;
