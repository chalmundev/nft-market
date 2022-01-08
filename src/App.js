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

import './App.scss';

const App = () => {
	const { state, dispatch, update } = useContext(appStore);

	console.log('state', state);

	const navigate = useNavigate()

	const { wallet, account } = state

	const onMount = () => {
		dispatch(onAppMount('world'));
	};
	useEffect(onMount, []);

	const handleClick = () => {
		update('clicked', !state.clicked);
	};

	return (
		<div>

			<nav>
				<ul>
					<li>
						<Link to="/">Home</Link>
					</li>
					<li>
						<Link to="/wallet">Wallet</Link>
					</li>
				</ul>
			</nav>

			<Routes>
				<Route path="/contract/:contractId" element={
					<RouteContract { ...{ dispatch, tokens: state.data.tokens } } />
				} />
				
				<Route path="/wallet" element={
					account ? <>
						<p>{ account.accountId }</p>
						<button onClick={() => wallet.signOut()}>Sign Out</button>
					</> :
					<>
						<p>Not Signed In</p>
						<button onClick={() => wallet.signIn()}>Sign In</button>
					</>
				} />
				
				<Route path="/" element={
					data.map(({ contractId, ts }) => {
						return <div key={contractId} onClick={() => navigate('/contract/' + contractId)}>
							{ contractId }
						</div>
					})
				} />
			</Routes>

		</div>
	);
};

export default App;
